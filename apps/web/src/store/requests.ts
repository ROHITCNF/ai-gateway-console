import { EMPTY_FILTERS, type GatewayRequest, type RequestFilters } from '@gateway/contracts';
import { createStore } from 'zustand/vanilla';
import type { ConnectionStatus, GatewayClient, StreamHandlers } from '@/gateway';

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
  /** New requests backfilled while disconnected (FR-31). */
  missed: number;
  /** Set when the stream comes back: how many missed requests were filled in. */
  reconnected: { missed: number; at: number } | null;
  /** Row open in the detail panel (FR-7). */
  selectedId: string | null;
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
  dismissReconnected(): void;
  select(id: string | null): void;
  /** Back to empty, e.g. on sign-out. */
  reset(): void;
}

export type RequestStore = ReturnType<typeof createRequestStore>;

const byNewest = (a: GatewayRequest, b: GatewayRequest) =>
  b.timestamp - a.timestamp || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/** What a merge added and dropped; lets aggregates update incrementally (D8). */
export interface Changes {
  added: GatewayRequest[];
  evicted: GatewayRequest[];
}

export type IngestListener = (changes: Changes) => void;

/** Merges `incoming` into newest-first `current`, deduping by id and capping at `max`. */
export function mergeNewest(
  current: readonly GatewayRequest[],
  incoming: readonly GatewayRequest[],
  ids: Set<string>,
  max: number,
  changes?: Changes,
): GatewayRequest[] {
  const fresh: GatewayRequest[] = [];
  for (const r of incoming) {
    if (ids.has(r.id)) continue;
    ids.add(r.id);
    fresh.push(r);
  }
  changes?.added.push(...fresh);
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
      if (!r) continue;
      ids.delete(r.id);
      changes?.evicted.push(r);
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
  opts: {
    max?: number;
    schedule?: (fn: () => void, ms: number) => unknown;
    /** Told about every request that enters or leaves the store, paused or not. */
    onIngest?: IngestListener;
  } = {},
) {
  const max = opts.max ?? MAX_REQUESTS;
  const merge = (current: readonly GatewayRequest[], incoming: readonly GatewayRequest[]) => {
    const changes: Changes = { added: [], evicted: [] };
    const merged = mergeNewest(current, incoming, ids, max, changes);
    if (changes.added.length || changes.evicted.length) opts.onIngest?.(changes);
    return merged;
  };
  const schedule = opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const ids = new Set<string>();
  let queue: GatewayRequest[] = [];
  let scheduled = false;

  const initial: RequestState = {
    requests: [],
    pending: [],
    paused: false,
    filters: EMPTY_FILTERS,
    load: 'idle',
    loadError: null,
    connection: 'connecting',
    version: 0,
    missed: 0,
    reconnected: null,
    selectedId: null,
  };

  return createStore<RequestState & RequestActions>()((set, get) => ({
    ...initial,

    setSnapshot(requests) {
      const s = get();
      set({
        requests: merge(s.requests, requests),
        load: 'ready',
        loadError: null,
        version: s.version + 1,
      });
    },

    receive(requests) {
      if (requests.length === 0) return;
      if (get().connection === 'disconnected') {
        const known = new Set(queue.map((r) => r.id));
        const fresh = requests.filter((r) => !ids.has(r.id) && !known.has(r.id)).length;
        set({ missed: get().missed + fresh });
      }
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
        // Charts keep following live traffic while the table is paused.
        if (add.length) opts.onIngest?.({ added: add, evicted: [] });
        set({ pending: s.pending.concat(add).slice(-max) });
        return;
      }
      set({ requests: merge(s.requests, batch), version: s.version + 1 });
    },

    pause() {
      set({ paused: true });
    },

    resume() {
      const s = get();
      set({
        paused: false,
        pending: [],
        requests: merge(s.requests, s.pending),
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
      const s = get();
      if (connection === s.connection) return;
      if (connection === 'disconnected') set({ connection, missed: 0, reconnected: null });
      else if (connection === 'connected' && s.connection === 'disconnected')
        set({ connection, reconnected: { missed: s.missed, at: Date.now() }, missed: 0 });
      else set({ connection });
    },

    select(selectedId) {
      set({ selectedId });
    },

    dismissReconnected() {
      set({ reconnected: null });
    },

    reset() {
      if (get().requests.length) opts.onIngest?.({ added: [], evicted: get().requests });
      ids.clear();
      queue = [];
      set(initial);
    },
  }));
}

/**
 * Wires the gateway client to the store: subscribe first so nothing is missed, then load the
 * snapshot (the store dedupes the overlap).
 */
export function connectRequests(
  client: GatewayClient,
  store: RequestStore,
  other: Omit<StreamHandlers, 'onRequests' | 'onStatus'> = {},
): () => void {
  const s = store.getState();
  const stop = client.subscribe({
    ...other,
    onRequests: (reqs) => store.getState().receive(reqs),
    onStatus: (status) => store.getState().setConnection(status),
  });
  if (s.load !== 'ready') void loadSnapshot(client, store);
  return stop;
}

/** Loads the newest 10k requests; on failure the store shows the error state (NFR-12). */
export async function loadSnapshot(client: GatewayClient, store: RequestStore): Promise<void> {
  store.getState().setLoad('loading');
  try {
    store.getState().setSnapshot(await client.getRequests({ limit: 10_000 }));
  } catch (e) {
    store.getState().setLoad('error', e instanceof Error ? e.message : 'Could not load requests');
  }
}
