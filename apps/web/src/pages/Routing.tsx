import { useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/states';
import { RoutingTable } from '@/features/routing/RoutingTable';
import { useGateway } from '@/gateway';
import { loadRules, useGatewayState } from '@/store';

/** S4: Routing (FR-16, FR-17, FR-32). */
export function RoutingPage() {
  const client = useGateway();
  const rules = useGatewayState((s) => s.rules);

  useEffect(() => {
    void loadRules(client);
  }, [client]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Routing"
        intro="Which model each feature uses first, and which backup takes over if it fails. Changes always go through a review step."
      />
      {rules.data ? (
        <>
          <RoutingTable rules={rules.data} />
          <p className="text-sm text-muted-foreground">
            Picking a new model opens the review step. Nothing changes until you confirm and the
            gateway accepts it.
          </p>
        </>
      ) : rules.error ? (
        <ErrorState
          title="Could not load routes"
          text={rules.error}
          onRetry={() => void loadRules(client)}
        />
      ) : (
        <LoadingState label="Loading routes…" rows={5} />
      )}
    </div>
  );
}
