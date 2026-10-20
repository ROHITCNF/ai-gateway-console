import { EMPTY_FILTERS, FEATURES, type GatewayRequest, MODELS } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { FakeGatewayClient } from '@/gateway/fake';
import { activeFilterCount, filterRequests } from './filters';
import { connectRequests, createRequestStore, mergeNewest } from './requests';

let n = 0;
const req = (timestamp: number, patch: Partial<GatewayRequest> = {}): GatewayRequest => ({
  id: `req_${n++}`,
  timestamp,
  featureId: 'support-bot',
  team: 'Customer Support',
  plannedModelId: 'claude-opus',
  servedModelId: 'claude-opus',
  status: 'success',
  latencyMs: 100,
  inputTokens: 10,
  outputTokens: 10,
  cost: 0.001,
  errorReason: null,
  ...patch,
});

const manual = () => {
  const jobs: (() => void)[] = [];
  const store = createRequestStore({ max: 100, schedule: (fn) => jobs.push(fn) });
  const run = () => {
    for (const job of jobs.splice(0)) job();
  };
  return { store, run, jobs };
};

describe('mergeNewest', () => {
  it('keeps newest first, dedupes and caps (D13.6)', () => {
    const ids = new Set<string>();
    const a = req(1);
    const b = req(2);
    const c = req(3);
    let list = mergeNewest([], [a, c], ids, 10);
    list = mergeNewest(list, [b, c], ids, 10);
    expect(list.map((r) => r.timestamp)).toEqual([3, 2, 1]);
    list = mergeNewest(list, [req(4), req(5)], ids, 3);
    expect(list.map((r) => r.timestamp)).toEqual([5, 4, 3]);
    expect(ids.has(a.id)).toBe(false);
  });
});

describe('request store', () => {
  it('batches live updates into one apply per flush (D7)', () => {
    const { store, run, jobs } = manual();
    store.getState().setSnapshot([req(1)]);
    store.getState().receive([req(2)]);
    store.getState().receive([req(3)]);
    expect(jobs).toHaveLength(1);
    expect(store.getState().requests).toHaveLength(1);
    const v = store.getState().version;
    run();
    expect(store.getState().requests.map((r) => r.timestamp)).toEqual([3, 2, 1]);
    expect(store.getState().version).toBe(v + 1);
  });

  it('pause holds new rows as pending, resume catches up (FR-4)', () => {
    const { store, run } = manual();
    store.getState().setSnapshot([req(1)]);
    store.getState().pause();
    store.getState().receive([req(2), req(3)]);
    run();
    expect(store.getState().requests).toHaveLength(1);
    expect(store.getState().pending).toHaveLength(2);
    store.getState().resume();
    expect(store.getState().requests.map((r) => r.timestamp)).toEqual([3, 2, 1]);
    expect(store.getState().pending).toHaveLength(0);
  });

  it('caps at max', () => {
    const { store, run } = manual();
    store.getState().receive(Array.from({ length: 150 }, (_, i) => req(i)));
    run();
    expect(store.getState().requests).toHaveLength(100);
    expect(store.getState().requests[0]?.timestamp).toBe(149);
  });
});

describe('filterRequests (FR-5, FR-6)', () => {
  const now = Date.UTC(2026, 9, 20, 12);
  const rows = [
    req(now - 1000, { id: 'req_ABC', featureId: 'code-review', team: 'Developer Platform' }),
    req(now - 2000, { status: 'failed', servedModelId: null, errorReason: 'timeout' }),
    req(now - 3000, { status: 'fallback', servedModelId: 'claude-sonnet' }),
    req(now - 10 * 60_000, { plannedModelId: 'gpt', servedModelId: 'gpt' }),
    req(now - 2 * 3600_000),
  ];
  const f = (patch: Partial<typeof EMPTY_FILTERS>) =>
    filterRequests(rows, { ...EMPTY_FILTERS, ...patch }, now);

  it('filters by feature, team, status, model', () => {
    expect(f({ featureId: 'code-review' })).toHaveLength(1);
    expect(f({ team: 'Customer Support' })).toHaveLength(4);
    expect(f({ status: 'failed' })).toHaveLength(1);
    expect(f({ status: 'fallback' })).toHaveLength(1);
    expect(f({ modelId: 'claude-sonnet' })).toHaveLength(1);
    expect(f({ modelId: 'claude-opus' })).toHaveLength(4);
    expect(f({ modelId: 'gpt' })).toHaveLength(1);
  });

  it('filters by time range', () => {
    expect(f({ timeRange: '5m' })).toHaveLength(3);
    expect(f({ timeRange: '1h' })).toHaveLength(4);
    expect(f({ timeRange: 'all' })).toHaveLength(5);
  });

  it('searches request id, case-insensitive substring', () => {
    expect(f({ requestId: 'abc' }).map((r) => r.id)).toEqual(['req_ABC']);
    expect(f({ requestId: '  ' })).toHaveLength(5);
  });

  it('combines filters and counts active ones', () => {
    expect(f({ team: 'Customer Support', status: 'failed', timeRange: '5m' })).toHaveLength(1);
    expect(activeFilterCount({ ...EMPTY_FILTERS, status: 'failed', timeRange: '1h' })).toBe(2);
  });

  it('filters 10k rows in under 100 ms (NFR-2)', () => {
    const big: GatewayRequest[] = Array.from({ length: 10_000 }, (_, i) => {
      const feature = FEATURES[i % FEATURES.length];
      const model = MODELS[i % MODELS.length];
      return req(now - i * 100, {
        featureId: feature?.id,
        team: feature?.team,
        servedModelId: model?.id ?? null,
        status: i % 25 === 0 ? 'fallback' : 'success',
      });
    });
    const t0 = performance.now();
    for (const p of [
      { featureId: 'support-bot' as const },
      { status: 'fallback' as const, timeRange: '1h' as const },
      { modelId: 'gpt' as const, requestId: '9' },
    ]) {
      filterRequests(big, { ...EMPTY_FILTERS, ...p }, now);
    }
    expect((performance.now() - t0) / 3).toBeLessThan(100);
  });
});

describe('connection state (FR-31)', () => {
  it('counts backfilled requests while disconnected and reports them on reconnect', () => {
    const { store, run } = manual();
    const a = req(1);
    store.getState().setSnapshot([a]);
    store.getState().setConnection('connected');
    store.getState().setConnection('disconnected');
    store.getState().receive([a, req(2), req(3)]);
    store.getState().setConnection('connected');
    run();
    expect(store.getState().reconnected?.missed).toBe(2);
    expect(store.getState().requests).toHaveLength(3);
    store.getState().reset();
    expect(store.getState().requests).toHaveLength(0);
  });
});

describe('connectRequests', () => {
  it('subscribes, loads the snapshot and follows the stream', async () => {
    const client = new FakeGatewayClient({ requests: [req(1), req(2)] });
    const { store, run } = manual();
    const stop = connectRequests(client, store);
    expect(store.getState().load).toBe('loading');
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState().load).toBe('ready');
    expect(store.getState().requests).toHaveLength(2);
    client.emitStatus('connected');
    expect(store.getState().connection).toBe('connected');
    client.emitRequests([req(3)]);
    run();
    expect(store.getState().requests[0]?.timestamp).toBe(3);
    stop();
    expect(client.subscribers).toBe(0);
  });

  it('shows an error state when the snapshot fails (NFR-12)', async () => {
    const client = new FakeGatewayClient();
    client.fail.getRequests = 'Cannot reach the gateway';
    const { store } = manual();
    connectRequests(client, store);
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getState().load).toBe('error');
    expect(store.getState().loadError).toBe('Cannot reach the gateway');
  });
});
