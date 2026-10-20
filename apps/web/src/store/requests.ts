import { EMPTY_FILTERS, type GatewayRequest, type RequestFilters } from '@gateway/contracts';
import { createStore } from 'zustand/vanilla';
import type { ConnectionStatus, GatewayClient } from '@/gateway';

/** Browser cap (D13.6): keep the newest 50k, drop the oldest. */
export const MAX_REQUESTS = 50_000;
/** Live updates are applied in batches (D7). */
export const FLUSH_MS = 250;

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface RequestState {
  /** Newest first. Replaced (never mutated) on each applied batch. */
  requests: GatewayRequest[];
  /** Arrived while paused; shown as "N new" (FR-4). */
  pending: GatewayRequest[];
  paused: boolean;
  filters: RequestFilters;
  load: LoadState;
  loadError: string | null;
  connection: ConnectionStatus;
  /** Bumps on every applied batch; aggregates and charts key off it. */
  version: number;
}

export interface RequestActions {
  setSnapshot(requests: GatewayRequest[]): void;
  /** Queue incoming requests; applied at most every FLUSH_MS. */
  receive(requests: GatewayRequest[]): void;
  /** Apply queued requests now (also used by tests). */
  flush(): void;
  pause(): void;
  resume(): void;
  setFilters(patch: Partial<RequestFilters>): void;
  clearFilters(): void;
  setLoad(load: LoadState, error?: string | null): void;
  setConnection(status: ConnectionStatus): void;
}

export type RequestStore = ReturnType<typeof createRequestStore>;

const byNewest = (a: GatewayRequest, b: GatewayRequest) =>
  b.timestamp - a.timestamp || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/** Merges `incoming` into newest-first `current`, deduping by id and capping at `max`. */
export function mergeNewest(
  current: readonly GatewayRequest[],
  incoming: readonly GatewayRequest[],
  ids: Set<string>,
  max: number,
): GatewayRequest[] {
  const fresh: GatewayRequest[] = [];
  for (const r of incoming) {
    if (ids.has(r.id)) continue;
    ids.add(r.id);
    fresh.push(r);
  }
  if (fresh.length === 0) return current as GatewayRequest[];
  fresh.sort(byNewest);
  const head = current[0];
  const oldestFresh = fresh[fresh.length - 1];
  // Common case: everything new is newer than what we have → prepend. Backfill may interleave.
  let merged =
    !head || (oldestFresh && oldestFresh.timestamp >= head.timestamp)
      ? fresh.concat(current)
      : current.concat(fresh).sort(byNewest);
  if (merged.length > max) {
    for (let i = max; i < merged.length; i++) {
      const r = merged[i];
      if (r) ids.delete(r.id);
    }
    merged = merged.slice(0, max);
  }
  return merged;
}

/**
 * The request store lives outside React (D8). Components subscribe to slices of it.
 * `schedule` lets tests drive batching without timers.
 */
export function createRequestStore(
  opts: { max?: number; schedule?: (fn: () => void, ms: number) => unknown } = {},
) {
  const max = opts.max ?? MAX_REQUESTS;
  const schedule = opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const ids = new Set<string>();
  let queue: GatewayRequest[] = [];
  let scheduled = false;

  return createStore<RequestState & RequestActions>()((set, get) => ({
    requests: [],
    pending: [],
    paused: false,
    filters: EMPTY_FILTERS,
    load: 'idle',
    loadError: null,
    connection: 'connecting',
    version: 0,

    setSnapshot(requests) {
      const s = get();
      set({
        requests: mergeNewest(s.requests, requests, ids, max),
        load: 'ready',
        loadError: null,
        version: s.version + 1,
      });
    },

    receive(requests) {
      if (requests.length === 0) return;
      queue = queue.concat(requests);
      if (!scheduled) {
        scheduled = true;
        schedule(() => get().flush(), FLUSH_MS);
      }
    },

    flush() {
      scheduled = false;
      if (queue.length === 0) return;
      const batch = queue;
      queue = [];
      const s = get();
      if (s.paused) {
        const known = new Set(s.pending.map((r) => r.id));
        const add = batch.filter((r) => !ids.has(r.id) && !known.has(r.id));
        set({ pending: s.pending.concat(add).slice(-max) });
        return;
      }
      set({ requests: mergeNewest(s.requests, batch, ids, max), version: s.version + 1 });
    },

    pause() {
      set({ paused: true });
    },

    resume() {
      const s = get();
      set({
        paused: false,
        pending: [],
        requests: mergeNewest(s.requests, s.pending, ids, max),
        version: s.version + 1,
      });
    },

    setFilters(patch) {
      set({ filters: { ...get().filters, ...patch } });
    },

    clearFilters() {
      set({ filters: EMPTY_FILTERS });
    },

    setLoad(load, error = null) {
      set({ load, loadError: error });
    },

    setConnection(connection) {
      set({ connection });
    },
  }));
}

/**
 * Wires the gateway client to the store: subscribe first so nothing is missed, then load the
 * snapshot (the store dedupes the overlap).
 */
export function connectRequests(client: GatewayClient, store: RequestStore): () => void {
  const s = store.getState();
  const stop = client.subscribe({
    onRequests: (reqs) => store.getState().receive(reqs),
    onStatus: (status) => store.getState().setConnection(status),
  });
  if (s.load !== 'ready') {
    s.setLoad('loading');
    client
      .getRequests({ limit: 10_000 })
      .then((reqs) => store.getState().setSnapshot(reqs))
      .catch((e: unknown) =>
        store
          .getState()
          .setLoad('error', e instanceof Error ? e.message : 'Could not load requests'),
      );
  }
  return stop;
}
