import type { GatewayRequest, RequestFilters, TimeRange } from '@gateway/contracts';

/** Earliest timestamp inside a time range (D13.5). `today` = since local midnight. */
export function rangeStart(range: TimeRange, now: number): number {
  switch (range) {
    case '5m':
      return now - 5 * 60_000;
    case '1h':
      return now - 3600_000;
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case 'all':
      return Number.NEGATIVE_INFINITY;
  }
}

/**
 * Applies Live Requests filters to store data (FR-5, FR-6, D8). Input and output newest first.
 * Model matches the planned or the served model, so a fallback away from a model still shows
 * under that model.
 */
export function filterRequests(
  requests: readonly GatewayRequest[],
  f: RequestFilters,
  now: number,
): GatewayRequest[] {
  const start = rangeStart(f.timeRange, now);
  const id = f.requestId.trim().toLowerCase();
  const out: GatewayRequest[] = [];
  for (const r of requests) {
    // Newest first: once older than the range start, the rest are too.
    if (r.timestamp < start) break;
    if (f.featureId && r.featureId !== f.featureId) continue;
    if (f.team && r.team !== f.team) continue;
    if (f.status && r.status !== f.status) continue;
    if (f.modelId && r.servedModelId !== f.modelId && r.plannedModelId !== f.modelId) continue;
    if (id && !r.id.toLowerCase().includes(id)) continue;
    out.push(r);
  }
  return out;
}

export function activeFilterCount(f: RequestFilters): number {
  return (
    (f.featureId ? 1 : 0) +
    (f.team ? 1 : 0) +
    (f.modelId ? 1 : 0) +
    (f.status ? 1 : 0) +
    (f.timeRange !== 'all' ? 1 : 0) +
    (f.requestId.trim() ? 1 : 0)
  );
}
