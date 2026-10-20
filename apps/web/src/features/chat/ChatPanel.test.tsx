import type { ChatResponse } from '@gateway/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { requestStore } from '@/store';
import { renderApp } from '@/test/render';

const admin = { name: 'Priya', role: 'admin' as const };
const viewer = { name: 'Sam', role: 'viewer' as const };

async function openChat(opts: Parameters<typeof renderApp>[0]) {
  const utils = renderApp(opts);
  fireEvent.click(await screen.findByRole('button', { name: 'Ask' }));
  const panel = await screen.findByRole('complementary', { name: 'Ask your gateway' });
  return { ...utils, panel };
}

async function say(panel: HTMLElement, text: string) {
  fireEvent.change(within(panel).getByLabelText('Message'), { target: { value: text } });
  fireEvent.click(within(panel).getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(within(panel).queryByText('Thinking…')).toBeNull());
}

const filterReply: ChatResponse = {
  understood: 'Filter: feature = support-bot, status = failed, time = today',
  reply: 'Done. Live Requests now shows only the matching requests.',
  action: {
    kind: 'filter',
    filters: {
      featureId: 'support-bot',
      team: null,
      modelId: null,
      status: 'failed',
      timeRange: 'today',
      requestId: '',
    },
  },
};

const proposal: ChatResponse = {
  understood: 'Route change: support-bot main Claude Opus → Claude Haiku',
  reply: 'Review the change and click Confirm to apply it.',
  action: {
    kind: 'propose_route_change',
    featureId: 'support-bot',
    mainModelId: 'claude-haiku',
    fallbackModelId: 'claude-sonnet',
  },
};

describe('Chat panel (S7, FR-24..FR-28)', () => {
  it('loads only when opened and offers example prompts (NFR-4)', async () => {
    renderApp({ user: admin, path: '/routing' });
    await screen.findByRole('button', { name: 'Ask' });
    expect(screen.queryByRole('complementary', { name: 'Ask your gateway' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    const panel = await screen.findByRole('complementary', { name: 'Ask your gateway' });
    const chips = within(
      within(panel).getByRole('list', { name: 'Example questions' }),
    ).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toContain('Move support-bot to a cheaper model');
  });

  it('does not offer a route change example to Viewers', async () => {
    const { panel } = await openChat({ user: viewer, path: '/routing' });
    expect(within(panel).queryByText('Move support-bot to a cheaper model')).toBeNull();
  });

  it('applies a filter to Live Requests and shows what it understood (FR-25, FR-28, Flow E)', async () => {
    const { client, panel } = await openChat({ user: viewer, path: '/routing' });
    client.chatReply = filterReply;
    await say(panel, 'show failed requests from support-bot today');
    expect(within(panel).getByTestId('understood').textContent).toBe(filterReply.understood);
    expect(requestStore.getState().filters).toEqual(
      filterReply.action.kind === 'filter' ? filterReply.action.filters : null,
    );
    expect(await screen.findByRole('heading', { name: 'Live Requests' })).toBeDefined();
    const sent = client.calls.find((c) => c.method === 'chat')?.args[0] as {
      text: string;
      timezoneOffsetMinutes: number;
    };
    expect(sent).toEqual({
      text: 'show failed requests from support-bot today',
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
    });
  });

  it('opens the review step with source chat and never applies on its own (Flow D, FR-26, NFR-5)', async () => {
    const { client, panel } = await openChat({ user: admin, path: '/routing' });
    client.chatReply = proposal;
    await say(panel, 'move support-bot to a cheaper model');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Suggested via chat')).toBeDefined();
    expect(client.calls.some((c) => c.method === 'changeRoute')).toBe(false);
    expect(client.rules.find((r) => r.featureId === 'support-bot')?.mainModelId).toBe(
      'claude-opus',
    );

    // Cancel, then reopen from the reply's button and Confirm.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(
      within(panel).getByRole('button', { name: 'Review change: support-bot → Claude Haiku' }),
    );
    const again = await screen.findByRole('dialog');
    fireEvent.click(within(again).getByRole('button', { name: 'Confirm change' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(client.history[0]).toMatchObject({ source: 'chat', newMainModelId: 'claude-haiku' });
  });

  it('shows a Viewer refusal politely with a way to see the route (FR-27, Flow F)', async () => {
    const { client, panel } = await openChat({ user: viewer, path: '/' });
    client.chatReply = {
      understood: 'Route change: support-bot → Grok (Admins only)',
      reply: 'Sorry, only Admins can change routes. support-bot uses Claude Opus.',
      action: { kind: 'refuse' },
    };
    await say(panel, 'move support-bot to Grok');
    expect(within(panel).getByText(/only Admins can change routes/)).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Open Routing' }));
    expect(await screen.findByRole('heading', { name: 'Routing' })).toBeDefined();
  });

  it('rejects an action outside the allowed list (NFR-7)', async () => {
    const { client, panel } = await openChat({ user: admin, path: '/routing' });
    client.chatReply = {
      understood: 'Apply',
      reply: 'Applied!',
      action: { kind: 'apply_route_change', featureId: 'support-bot' },
    } as unknown as ChatResponse;
    await say(panel, 'apply it');
    expect(within(panel).getByText(/not allowed to take/)).toBeDefined();
    expect(within(panel).getByTestId('understood').textContent).toBe('Not understood');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows an error when the gateway cannot answer', async () => {
    const { client, panel } = await openChat({ user: admin, path: '/' });
    client.fail.chat = 'Cannot reach the gateway';
    await say(panel, 'total spend');
    expect(within(panel).getByRole('alert').textContent).toBe('Cannot reach the gateway');
  });

  it('keeps the conversation across screens and closes with Escape', async () => {
    const { client, panel } = await openChat({ user: admin, path: '/' });
    client.chatReply = {
      understood: 'Show route: support-bot',
      reply: 'support-bot uses Claude Opus.',
      action: { kind: 'show_route', featureId: 'support-bot' },
    };
    await say(panel, 'what model does support-bot use');
    fireEvent.click(within(panel).getByRole('button', { name: 'Open Routing' }));
    await screen.findByRole('heading', { name: 'Routing' });
    expect(within(panel).getByText('support-bot uses Claude Opus.')).toBeDefined();
    fireEvent.keyDown(within(panel).getByLabelText('Message'), { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Ask your gateway' })).toBeNull(),
    );
  });
});
