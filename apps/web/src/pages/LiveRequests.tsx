import { useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DetailPanel } from '@/features/live/DetailPanel';
import { FilterSummary } from '@/features/live/FilterSummary';
import { PauseControl } from '@/features/live/PauseControl';
import { RequestTable } from '@/features/live/RequestTable';
import { Toolbar } from '@/features/live/Toolbar';
import { useFilteredRequests, useRequests } from '@/store';

/** S2: Live Requests, the landing screen. */
export function LiveRequestsPage() {
  const rows = useFilteredRequests();
  const selectedId = useRequests((s) => s.selectedId);
  const select = useRequests((s) => s.select);
  const selected = useRequests((s) =>
    s.selectedId ? (s.requests.find((r) => r.id === s.selectedId) ?? null) : null,
  );
  const close = useCallback(() => select(null), [select]);

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
        <div className="min-w-0 flex-1">
          <RequestTable rows={rows} selectedId={selectedId} onSelect={select} />
        </div>
        <DetailPanel request={selected} onClose={close} />
      </div>
    </div>
  );
}
