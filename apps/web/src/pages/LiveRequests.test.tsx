import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { requestStore } from '@/store';
import { makeRequest } from '@/test/factories';
import { mockLayout } from '@/test/layout';
import { renderApp } from '@/test/render';

beforeAll(() => mockLayout());

const seed = () => [
  makeRequest({ id: 'req_aaa111' }),
  makeRequest({
    id: 'req_bbb222',
    status: 'failed',
    servedModelId: null,
    cost: 0,
    outputTokens: 0,
    errorReason: 'timeout',
  }),
  makeRequest({
    id: 'req_ccc333',
    featureId: 'code-review',
    team: 'Developer Platform',
    plannedModelId: 'claude-sonnet',
    servedModelId: 'claude-sonnet',
  }),
];

async function setup() {
  const utils = renderApp({ user: { name: 'Sam', role: 'viewer' } });
  utils.client.requests = seed();
  await screen.findByText(/Showing 3 of 3 requests/);
  return utils;
}

const rowIds = () =>
  screen
    .queryAllByRole('row')
    .map((r) => r.getAttribute('data-request-id'))
    .filter(Boolean);

describe('Live Requests toolbar (FR-4, FR-5, FR-6)', () => {
  it('filters by status and shows a removable chip', async () => {
    await setup();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } });
    expect(rowIds()).toEqual(['req_bbb222']);
    expect(screen.getByText('Showing 1 of 3 requests')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Status: Failed' }));
    expect(rowIds()).toHaveLength(3);
  });

  it('filters by feature, team, model and searches by ID', async () => {
    await setup();
    fireEvent.change(screen.getByLabelText('Feature'), { target: { value: 'code-review' } });
    expect(rowIds()).toEqual(['req_ccc333']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 'Customer Support' } });
    expect(rowIds()).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'claude-sonnet' } });
    expect(rowIds()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    fireEvent.change(screen.getByLabelText('Request ID'), { target: { value: 'BBB' } });
    expect(rowIds()).toEqual(['req_bbb222']);
  });

  it('switches time range', async () => {
    await setup();
    const group = screen.getByRole('group', { name: 'Time range' });
    fireEvent.click(within(group).getByRole('button', { name: '5 min' }));
    expect(requestStore.getState().filters.timeRange).toBe('5m');
    expect(within(group).getByRole('button', { name: '5 min' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('pauses new rows and resumes to catch up (FR-4)', async () => {
    const { client } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => {
      client.emitRequests([makeRequest({ id: 'req_new1', timestamp: Date.now() + 1000 })]);
      requestStore.getState().flush();
    });
    expect(screen.getByText('Paused · 1 new')).toBeDefined();
    expect(rowIds()).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(rowIds()[0]).toBe('req_new1');
  });
});

describe('Live Requests states (NFR-12)', () => {
  it('shows loading, then the error state with retry', async () => {
    const { client } = renderApp({ user: { name: 'Sam', role: 'viewer' } });
    client.fail.getRequests = 'Cannot reach the gateway';
    expect(await screen.findByText(/Could not load requests/)).toBeDefined();
    delete client.fail.getRequests;
    client.requests = seed();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/Showing 3 of 3 requests/)).toBeDefined();
  });

  it('shows the no-match state with clear filters', async () => {
    await setup();
    fireEvent.change(screen.getByLabelText('Request ID'), { target: { value: 'zzz' } });
    expect(screen.getByText('No requests match these filters')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(rowIds()).toHaveLength(3);
  });

  it('shows an empty state when there is no traffic', async () => {
    renderApp({ user: { name: 'Sam', role: 'viewer' } });
    expect(await screen.findByText('No requests yet')).toBeDefined();
  });
});
