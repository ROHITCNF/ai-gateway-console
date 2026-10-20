import type { GatewayRequest } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { Aggregates, percentile } from './aggregates';
import { createRequestStore } from './requests';

let n = 0;
const req = (timestamp: number, patch: Partial<GatewayRequest> = {}): GatewayRequest => ({
  id: `r${n++}`,
  timestamp,
  featureId: 'support-bot',
  team: 'Customer Support',
  plannedModelId: 'claude-opus',
  servedModelId: 'claude-opus',
  status: 'success',
  latencyMs: 100,
  inputTokens: 10,
  outputTokens: 10,
  cost: 1,
  errorReason: null,
  ...patch,
});

const NOW = 10 * 3600_000;

describe('percentile', () => {
  it('uses nearest rank', () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(95);
    expect(percentile([], 50)).toBeNull();
  });
});

describe('Aggregates (D8)', () => {
  it('totals spend, count, failed and fallback by range', () => {
    const a = new Aggregates();
    a.ingest({
      added: [
        req(NOW - 60_000, { cost: 2 }),
        req(NOW - 120_000, { status: 'failed', servedModelId: null, cost: 0 }),
        req(NOW - 30 * 60_000, {
          status: 'fallback',
          servedModelId: 'claude-sonnet',
          cost: 0.5,
          featureId: 'code-review',
        }),
        req(NOW - 2 * 3600_000, { cost: 10 }),
      ],
      evicted: [],
    });
    const m5 = a.query('5m', NOW);
    expect(m5).toMatchObject({ count: 2, spend: 2, failed: 1, fallback: 0 });
    const h1 = a.query('1h', NOW);
    expect(h1).toMatchObject({ count: 3, spend: 2.5, failed: 1, fallback: 1 });
    expect(h1.byModel).toEqual([
      { id: 'claude-opus', spend: 2 },
      { id: 'claude-sonnet', spend: 0.5 },
    ]);
    expect(h1.byFeature[0]).toEqual({ id: 'support-bot', spend: 2 });
    expect(a.query('all', NOW).spend).toBe(12.5);
  });

  it('builds a continuous series with p50/p95 per display bucket', () => {
    const a = new Aggregates();
    const added = Array.from({ length: 100 }, (_, i) => req(NOW - 30_000, { latencyMs: i + 1 }));
    a.ingest({ added, evicted: [] });
    const s = a.query('5m', NOW);
    expect(s.bucketMs).toBe(10_000);
    const point = s.series.find((p) => p.count > 0);
    expect(point).toMatchObject({ count: 100, p50: 50, p95: 95 });
    expect(s.series.at(-1)?.t).toBe(NOW);
    expect(s.series.every((p, i) => i === 0 || p.t - (s.series[i - 1]?.t ?? 0) === 10_000)).toBe(
      true,
    );
  });

  it('dedupes and removes evicted requests', () => {
    const a = new Aggregates();
    const r = req(NOW - 1000, { cost: 3 });
    a.ingest({ added: [r, r], evicted: [] });
    expect(a.query('all', NOW).count).toBe(1);
    a.ingest({ added: [], evicted: [r] });
    expect(a.query('all', NOW)).toMatchObject({ count: 0, spend: 0, series: [] });
  });

  it('stays in sync with the store, including the cap and pause', () => {
    const a = new Aggregates();
    const jobs: (() => void)[] = [];
    const store = createRequestStore({
      max: 5,
      schedule: (fn) => jobs.push(fn),
      onIngest: (c) => a.ingest(c),
    });
    store.getState().setSnapshot(Array.from({ length: 4 }, (_, i) => req(NOW - 10_000 + i)));
    store.getState().pause();
    store.getState().receive([req(NOW - 100), req(NOW - 50)]);
    for (const j of jobs.splice(0)) j();
    expect(a.query('all', NOW).count).toBe(6);
    store.getState().resume();
    expect(store.getState().requests).toHaveLength(5);
    expect(a.query('all', NOW).count).toBe(5);
  });

  it('queries 50k requests quickly', () => {
    const a = new Aggregates();
    a.ingest({ added: Array.from({ length: 50_000 }, (_, i) => req(NOW - i * 200)), evicted: [] });
    const t0 = performance.now();
    a.query('all', NOW);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
