import { Clock } from 'lucide-react';
import { useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { HistoryTable } from '@/features/history/HistoryTable';
import { useGateway } from '@/gateway';
import { loadHistory, loadRules, useGatewayState } from '@/store';

/** S6: History of confirmed route changes (FR-22). */
export function HistoryPage() {
  const client = useGateway();
  const history = useGatewayState((s) => s.history);

  useEffect(() => {
    void loadHistory(client);
    void loadRules(client);
  }, [client]);

  return (
    <div className="space-y-4">
      <PageHeader title="History" intro="Every confirmed routing change, newest first." />
      {history.data ? (
        history.data.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No route changes yet"
            text="Confirmed changes from Routing or the chat panel will show up here."
          />
        ) : (
          <HistoryTable changes={history.data} />
        )
      ) : history.error ? (
        <ErrorState
          title="Could not load history"
          text={history.error}
          onRetry={() => void loadHistory(client)}
        />
      ) : (
        <LoadingState label="Loading history…" rows={4} />
      )}
    </div>
  );
}
