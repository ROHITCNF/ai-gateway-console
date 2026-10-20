import { useMemo } from 'react';
import { useStore } from 'zustand';
import { filterRequests } from './filters';
import { createRequestStore, type RequestActions, type RequestState } from './requests';

export * from './filters';
export * from './requests';

/** App-wide request store (D8). */
export const requestStore = createRequestStore();

export function useRequests<T>(selector: (s: RequestState & RequestActions) => T): T {
  return useStore(requestStore, selector);
}

/** Filtered rows, recomputed only when data or filters change (NFR-2). */
export function useFilteredRequests() {
  const requests = useRequests((s) => s.requests);
  const filters = useRequests((s) => s.filters);
  const version = useRequests((s) => s.version);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version bumps when time moves on with new data
  return useMemo(() => filterRequests(requests, filters, Date.now()), [requests, filters, version]);
}
export * from './gateway';
