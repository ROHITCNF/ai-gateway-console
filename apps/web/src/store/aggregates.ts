import type { FeatureId, GatewayRequest, ModelId, TimeRange } from '@gateway/contracts';
import { rangeStart } from './filters';
import type { Changes } from './requests';

/** Base bucket width. Charts merge these into wider display buckets (D8). */
export const BUCKET_MS = 10_000;

/** Display bucket width per time range: ~30–60 points per chart. */
export const DISPLAY_BUCKET_MS: Record<TimeRange, number> = {
  '5m': 10_000,
  '1h': 60_000,
  today: 5 * 60_000,
  all: 5 * 60_000,
};

interface Bucket {
  start: number;
  count: number;
  spend: number;
  failed: number;
  fallback: number;
  latencies: number[];
  byModel: Map<ModelId, number>;
  byFeature: Map<FeatureId, number>;
}

export interface SeriesPoint {
  /** Bucket start, epoch ms. */
  t: number;
  spend: number;
  count: number;
  p50: number | null;
  p95: number | null;
}

export interface Summary {
  count: number;
  spend: number;
  failed: number;
  fallback: number;
  /** Requests per second over the covered span. */
  ratePerSec: number;
  byModel: { id: ModelId; spend: number }[];
  byFeature: { id: FeatureId; spend: number }[];
  bucketMs: number;
  series: SeriesPoint[];
}

/** Nearest-rank percentile of a sorted array. */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))] ?? null;
}

const bump = <K>(m: Map<K, number>, k: K, v: number) => m.set(k, (m.get(k) ?? 0) + v);

/**
 * Time-bucket totals kept up to date as requests arrive and leave (D8). Charts and KPI tiles
 * read these, never the raw rows.
 */
export class Aggregates {
  #buckets = new Map<number, Bucket>();
  #seen = new Set<string>();
  version = 0;

  ingest({ added, evicted }: Changes): void {
    for (const r of added) this.#add(r);
    for (const r of evicted) this.#remove(r);
    this.version++;
  }

  #bucket(ts: number): Bucket {
    const start = Math.floor(ts / BUCKET_MS) * BUCKET_MS;
    let b = this.#buckets.get(start);
    if (!b) {
      b = {
        start,
        count: 0,
        spend: 0,
        failed: 0,
        fallback: 0,
        latencies: [],
        byModel: new Map(),
        byFeature: new Map(),
      };
      this.#buckets.set(start, b);
    }
    return b;
  }

  #add(r: GatewayRequest): void {
    if (this.#seen.has(r.id)) return;
    this.#seen.add(r.id);
    const b = this.#bucket(r.timestamp);
    b.count++;
    b.spend += r.cost;
    if (r.status === 'failed') b.failed++;
    if (r.status === 'fallback') b.fallback++;
    b.latencies.push(r.latencyMs);
    if (r.servedModelId) bump(b.byModel, r.servedModelId, r.cost);
    bump(b.byFeature, r.featureId, r.cost);
  }

  #remove(r: GatewayRequest): void {
    if (!this.#seen.delete(r.id)) return;
    const b = this.#bucket(r.timestamp);
    b.count--;
    b.spend -= r.cost;
    if (r.status === 'failed') b.failed--;
    if (r.status === 'fallback') b.fallback--;
    const i = b.latencies.indexOf(r.latencyMs);
    if (i >= 0) b.latencies.splice(i, 1);
    if (r.servedModelId) bump(b.byModel, r.servedModelId, -r.cost);
    bump(b.byFeature, r.featureId, -r.cost);
    if (b.count <= 0) this.#buckets.delete(b.start);
  }

  /** Totals, breakdowns and chart series for a time range ending at `now`. */
  query(range: TimeRange, now: number): Summary {
    const from = rangeStart(range, now);
    const width = DISPLAY_BUCKET_MS[range];
    const out: Summary = {
      count: 0,
      spend: 0,
      failed: 0,
      fallback: 0,
      ratePerSec: 0,
      byModel: [],
      byFeature: [],
      bucketMs: width,
      series: [],
    };
    const byModel = new Map<ModelId, number>();
    const byFeature = new Map<FeatureId, number>();
    const bins = new Map<number, { spend: number; count: number; lat: number[] }>();
    let first = Number.POSITIVE_INFINITY;

    for (const b of this.#buckets.values()) {
      if (b.start + BUCKET_MS <= from || b.count === 0) continue;
      first = Math.min(first, b.start);
      out.count += b.count;
      out.spend += b.spend;
      out.failed += b.failed;
      out.fallback += b.fallback;
      for (const [k, v] of b.byModel) bump(byModel, k, v);
      for (const [k, v] of b.byFeature) bump(byFeature, k, v);
      const t = Math.floor(b.start / width) * width;
      let bin = bins.get(t);
      if (!bin) {
        bin = { spend: 0, count: 0, lat: [] };
        bins.set(t, bin);
      }
      bin.spend += b.spend;
      bin.count += b.count;
      for (const l of b.latencies) bin.lat.push(l);
    }

    const sortDesc = <K>(m: Map<K, number>) =>
      [...m]
        .map(([id, spend]) => ({ id, spend: Math.max(0, spend) }))
        .sort((a, b) => b.spend - a.spend);
    out.byModel = sortDesc(byModel);
    out.byFeature = sortDesc(byFeature);
    out.spend = Math.max(0, out.spend);

    if (bins.size > 0) {
      const lo = Math.min(...bins.keys());
      const hi = Math.floor(now / width) * width;
      for (let t = lo; t <= Math.max(lo, hi); t += width) {
        const bin = bins.get(t);
        const lat = bin ? bin.lat.sort((a, b) => a - b) : [];
        out.series.push({
          t,
          spend: bin?.spend ?? 0,
          count: bin?.count ?? 0,
          p50: percentile(lat, 50),
          p95: percentile(lat, 95),
        });
      }
      const span = Math.max(1, (now - Math.max(first, from)) / 1000);
      out.ratePerSec = out.count / span;
    }
    return out;
  }
}
