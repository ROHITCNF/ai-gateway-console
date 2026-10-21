import type { RouteChange } from '@gateway/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatEstimate } from '@/features/history/HistoryTable';
import { FakeGatewayClient } from '@/gateway/fake';
import { renderApp } from '@/test/render';
import { chooseOption } from '@/test/select';

const admin = { name: 'Priya', role: 'admin' as const };

const change = (patch: Partial<RouteChange>): RouteChange => ({
  id: 'chg_1',
  timestamp: '2026-10-20T14:36:00.000Z',
  changedBy: 'Priya Rao',
  featureId: 'support-bot',
  oldMainModelId: 'claude-opus',
  newMainModelId: 'claude-sonnet',
  oldFallbackModelId: 'claude-sonnet',
  newFallbackModelId: 'claude-sonnet',
  source: 'chat',
  estimatedCostChangePercent: -80,
  ...patch,
});

describe('History (FR-22)', () => {
  it('lists changes newest first with who, models, source and estimate', async () => {
    const client = new FakeGatewayClient({ user: admin });
    client.history = [
      change({ id: 'b', timestamp: '2026-10-20T14:36:00.000Z' }),
      change({
        id: 'a',
        timestamp: '2026-10-18T10:00:00.000Z',
        changedBy: 'Arjun',
        source: 'click',
        estimatedCostChangePercent: 400,
      }),
    ];
    renderApp({ client, path: '/history' });
    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Priya Rao');
    expect(rows[0]?.textContent).toContain('Claude Opus → Claude Sonnet');
    expect(rows[0]?.textContent).toContain('No change');
    expect(within(rows[0] as HTMLElement).getByText('Via chat')).toBeDefined();
    expect(rows[0]?.textContent).toContain('−80%');
    expect(rows[1]?.textContent).toContain('+400%');
  });

  it('shows a new entry right after a confirmed change (Flow C step 7)', async () => {
    const { client } = renderApp({ user: admin, path: '/routing' });
    chooseOption(await screen.findByLabelText('Main model for support-bot'), 'Claude Haiku');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm change' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('link', { name: 'History' }));
    expect(await screen.findByText('Claude Opus → Claude Haiku')).toBeDefined();
    expect(client.history).toHaveLength(1);
  });

  it('shows the empty state (NFR-12)', async () => {
    renderApp({ user: admin, path: '/history' });
    expect(await screen.findByText('No route changes yet')).toBeDefined();
  });

  it('formats estimates', () => {
    expect(formatEstimate(0)).toBe('+0%');
    expect(formatEstimate(null)).toBe('—');
  });
});

describe('Undo (FR-23, Flow G)', () => {
  it('opens the review with source undo, confirms, restores the route and adds a new entry', async () => {
    const client = new FakeGatewayClient({ user: admin });
    client.rules = client.rules.map((r) =>
      r.featureId === 'support-bot'
        ? { ...r, mainModelId: 'claude-haiku', fallbackModelId: 'gemini' }
        : r,
    );
    client.history = [
      change({
        id: 'chg_1',
        newMainModelId: 'claude-haiku',
        newFallbackModelId: 'gemini',
        source: 'click',
      }),
      change({ id: 'chg_0', timestamp: '2026-10-19T00:00:00.000Z' }),
    ];
    renderApp({ client, path: '/history' });
    const undos = await screen.findAllByRole('button', { name: /Undo latest change/ });
    expect(undos).toHaveLength(1);
    fireEvent.click(undos[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: 'Review route change' });
    expect(within(dialog).getByText('Undo')).toBeDefined();
    expect(dialog.textContent).toContain('MainClaude HaikuClaude Opus');
    expect(dialog.textContent).toContain('BackupGeminiClaude Sonnet');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm change' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const rule = client.rules.find((r) => r.featureId === 'support-bot');
    expect(rule).toMatchObject({ mainModelId: 'claude-opus', fallbackModelId: 'claude-sonnet' });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0] as HTMLElement).getAllByText('Undo').length).toBeGreaterThan(0);
  });
});
