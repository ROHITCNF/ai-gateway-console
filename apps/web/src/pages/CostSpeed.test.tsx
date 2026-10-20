import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/factories';
import { renderApp } from '@/test/render';

vi.mock('@/charts/useEChart', () => ({ useEChart: () => ({ current: null }) }));

const now = Date.now();
const traffic = () => [
  makeRequest({ timestamp: now - 60_000, cost: 1 }),
  makeRequest({ timestamp: now - 90_000, cost: 0, status: 'failed', servedModelId: null }),
  makeRequest({
    timestamp: now - 20 * 60_000,
    cost: 3,
    status: 'fallback',
    servedModelId: 'claude-sonnet',
    featureId: 'code-review',
    team: 'Developer Platform',
  }),
  makeRequest({ timestamp: now - 2 * 3600_000, cost: 6 }),
];

async function setup() {
  const { client } = renderApp({ user: { name: 'Sam', role: 'viewer' }, path: '/cost' });
  client.requests = traffic();
  await screen.findByText('Total spend');
  return client;
}

describe('Cost & Speed (FR-10..FR-15)', () => {
  it('shows totals, failed and fallback share for the last hour', async () => {
    await setup();
    const tile = (label: string) => screen.getByText(label).closest('div') as HTMLElement;
    expect(within(tile('Total spend')).getByText('$4.00')).toBeDefined();
    expect(within(tile('Requests')).getByText('3')).toBeDefined();
    expect(tile('Failed').textContent).toContain('1· 33.3%');
    expect(tile('Fallbacks').textContent).toContain('1· 33.3%');
  });

  it('splits spend by model and by feature', async () => {
    await setup();
    const byModel = screen
      .getByRole('heading', { name: 'Spend by model' })
      .closest('section') as HTMLElement;
    expect(byModel.textContent).toContain('Claude Sonnet$3.00 · 75%');
    expect(byModel.textContent).toContain('Claude Opus$1.00 · 25%');
    const byFeature = screen
      .getByRole('heading', { name: 'Spend by feature' })
      .closest('section') as HTMLElement;
    expect(byFeature.textContent).toContain('code-review$3.00 · 75%');
  });

  it('switches the time range (FR-15)', async () => {
    await setup();
    const group = screen.getByRole('group', { name: 'Time range' });
    fireEvent.click(within(group).getByRole('button', { name: 'Last 5 min' }));
    expect(screen.getByText('$1.00', { selector: 'p' })).toBeDefined();
    fireEvent.click(within(group).getByRole('button', { name: 'All data' }));
    expect(screen.getByText('$10.00', { selector: 'p' })).toBeDefined();
  });

  it('shows the example price table from the API (FR-10, D3)', async () => {
    const client = await setup();
    expect(await screen.findByText('Example prices, per 1M tokens')).toBeDefined();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(8);
    expect(table.textContent).toContain('Claude Opus');
    expect(table.textContent).toContain('$75.00');
    expect(client.calls.some((c) => c.method === 'getModels')).toBe(true);
  });

  it('updates with new traffic', async () => {
    const client = await setup();
    act(() => {
      client.emitRequests([makeRequest({ timestamp: Date.now(), cost: 2 })]);
    });
    expect(await screen.findByText('$6.00')).toBeDefined();
  });

  it('shows the empty state when the range has no requests', async () => {
    renderApp({ user: { name: 'Sam', role: 'viewer' }, path: '/cost' });
    expect(await screen.findByText('No requests in this time range')).toBeDefined();
  });
});
