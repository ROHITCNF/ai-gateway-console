import { Inbox, Search } from 'lucide-react';
import { type ReactNode, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { DetailPanel } from '@/features/live/DetailPanel';
import { FilterSummary } from '@/features/live/FilterSummary';
import { PauseControl } from '@/features/live/PauseControl';
import { RequestTable } from '@/features/live/RequestTable';
import { Toolbar } from '@/features/live/Toolbar';
import { useGateway } from '@/gateway';
import {
  activeFilterCount,
  loadSnapshot,
  requestStore,
  useFilteredRequests,
  useRequests,
} from '@/store';

/** S2: Live Requests, the landing screen. */
export function LiveRequestsPage() {
  const rows = useFilteredRequests();
  const selectedId = useRequests((s) => s.selectedId);
  const select = useRequests((s) => s.select);
  const selected = useRequests((s) =>
    s.selectedId ? (s.requests.find((r) => r.id === s.selectedId) ?? null) : null,
  );
  const close = useCallback(() => select(null), [select]);
  const client = useGateway();
  const load = useRequests((s) => s.load);
  const loadError = useRequests((s) => s.loadError);
  const total = useRequests((s) => s.requests.length);
  const filtered = useRequests((s) => activeFilterCount(s.filters) > 0);
  const clear = useRequests((s) => s.clearFilters);

  let body: ReactNode;
  if (load === 'error' && total === 0) {
    body = (
      <ErrorState
        title="Could not load requests"
        text={`${loadError ?? 'The gateway did not answer.'} Nothing is lost; try again.`}
        onRetry={() => void loadSnapshot(client, requestStore)}
      />
    );
  } else if (total === 0 && load !== 'ready') {
    body = <LoadingState label="Loading requests…" />;
  } else if (rows.length === 0 && filtered) {
    body = (
      <EmptyState
        icon={Search}
        title="No requests match these filters"
        text="Try a wider time range or remove a filter."
        action={
          <Button variant="outline" onClick={clear}>
            Clear filters
          </Button>
        }
      />
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        icon={Inbox}
        title="No requests yet"
        text="New requests appear here as soon as the gateway sends them."
      />
    );
  } else {
    body = <RequestTable rows={rows} selectedId={selectedId} onSelect={select} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Requests"
        intro="Every AI request your features send through the gateway, newest first. Click a row to see what happened."
        actions={<PauseControl />}
      />
      <Toolbar />
      <FilterSummary shown={rows.length} />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">{body}</div>
        <DetailPanel request={selected} onClose={close} />
      </div>
    </div>
  );
}
