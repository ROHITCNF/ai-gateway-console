import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FakeGatewayClient } from '@/gateway/fake';
import { openReview } from '@/store';
import { renderApp } from '@/test/render';
import { chooseOption } from '@/test/select';

const viewer = { name: 'Sam', role: 'viewer' as const };

describe('Viewer UI (FR-21, Flow F)', () => {
  it('disables every routing picker with a short note', async () => {
    renderApp({ user: viewer, path: '/routing' });
    await screen.findByLabelText('Main model for support-bot');
    const pickers = screen.getAllByRole('combobox') as HTMLButtonElement[];
    expect(pickers).toHaveLength(10);
    expect(pickers.every((p) => p.disabled)).toBe(true);
    expect(screen.getByText(/Only Admins can change routes\./)).toBeDefined();
  });

  it('disables Undo in History with a note', async () => {
    const client = new FakeGatewayClient({ user: viewer });
    client.history = [
      {
        id: 'c1',
        timestamp: new Date().toISOString(),
        changedBy: 'Priya',
        featureId: 'support-bot',
        oldMainModelId: 'claude-opus',
        newMainModelId: 'claude-haiku',
        oldFallbackModelId: 'claude-sonnet',
        newFallbackModelId: 'claude-sonnet',
        source: 'click',
        estimatedCostChangePercent: -80,
      },
    ];
    renderApp({ client, path: '/history' });
    const undo = await screen.findByRole('button', { name: /Undo latest change/ });
    expect((undo as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Only Admins can undo changes.')).toBeDefined();
  });

  it('disables Confirm in the review step for viewers', async () => {
    const { client } = renderApp({ user: viewer, path: '/routing' });
    await screen.findByLabelText('Main model for support-bot');
    openReview({
      featureId: 'support-bot',
      mainModelId: 'claude-haiku',
      fallbackModelId: 'claude-sonnet',
      source: 'chat',
    });
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', {
      name: 'Confirm change',
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(client.calls.some((c) => c.method === 'changeRoute')).toBe(false);
    expect(within(dialog).getByText('Only Admins can change routes.')).toBeDefined();
  });

  it('shows the backend 403 and keeps the old route when the UI role is stale (NFR-6)', async () => {
    // UI only mirrors the role: an admin screen whose session became viewer still gets refused.
    const { client } = renderApp({ user: { name: 'Priya', role: 'admin' }, path: '/routing' });
    const picker = (await screen.findByLabelText(
      'Main model for support-bot',
    )) as HTMLButtonElement;
    client.user = viewer;
    chooseOption(picker, 'Claude Haiku');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm change' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('Only Admins can change routes');
    expect(client.rules.find((r) => r.featureId === 'support-bot')?.mainModelId).toBe(
      'claude-opus',
    );
    expect(screen.getByLabelText('Main model for support-bot').textContent).toBe('Claude Opus');
    expect(client.history).toHaveLength(0);
  });

  it('admins keep enabled controls', async () => {
    renderApp({ user: { name: 'Priya', role: 'admin' }, path: '/routing' });
    const picker = (await screen.findByLabelText(
      'Main model for support-bot',
    )) as HTMLButtonElement;
    expect(picker.disabled).toBe(false);
    expect(screen.queryByText(/Only Admins can change routes/)).toBeNull();
  });
});
