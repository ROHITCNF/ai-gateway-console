import { Clock, Undo2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { HistoryTable } from '@/features/history/HistoryTable';
import { undoableIds, undoTarget } from '@/features/history/undo';
import { useGateway } from '@/gateway';
import { loadHistory, loadRules, openReview, useGatewayState } from '@/store';

/** S6: History of confirmed route changes (FR-22). */
export function HistoryPage() {
  const client = useGateway();
  const history = useGatewayState((s) => s.history);
  const undoable = useMemo(() => undoableIds(history.data ?? []), [history.data]);

  useEffect(() => {
    void loadHistory(client);
    void loadRules(client);
  }, [client]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="History"
        intro="Every confirmed routing change, newest first. You can undo the latest change for each feature."
      />
      {history.data ? (
        history.data.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No route changes yet"
            text="Confirmed changes from Routing or the chat panel will show up here."
          />
        ) : (
          <>
            <HistoryTable
              changes={history.data}
              action={(c) =>
                undoable.has(c.id) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReview(undoTarget(c))}
                    aria-label={`Undo latest change to ${c.featureId}`}
                  >
                    <Undo2 aria-hidden /> Undo
                  </Button>
                )
              }
            />
            <p className="text-sm text-muted-foreground">
              Undo opens the review step and restores both the old main and backup model. It is
              saved here as a new change.
            </p>
          </>
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
