import { PageHeader } from '@/components/PageHeader';
import { RequestTable } from '@/features/live/RequestTable';
import { useFilteredRequests, useRequests } from '@/store';

/** S2: Live Requests, the landing screen. */
export function LiveRequestsPage() {
  const rows = useFilteredRequests();
  const selectedId = useRequests((s) => s.selectedId);
  const select = useRequests((s) => s.select);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Requests"
        intro="Every AI request your features send through the gateway, newest first. Click a row to see what happened."
      />
      <RequestTable rows={rows} selectedId={selectedId} onSelect={select} />
    </div>
  );
}
