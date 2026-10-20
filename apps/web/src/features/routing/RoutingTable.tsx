import { FEATURES, getFeature, MODELS, ModelId, type RoutingRule } from '@gateway/contracts';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ADMIN_ONLY, useCanChangeRoutes } from '@/auth/useCanChangeRoutes';
import { Select } from '@/components/ui/field';
import { formatDateTime, modelName } from '@/lib/format';
import { openReview, useGatewayState } from '@/store';

function ModelPicker({
  id,
  label,
  value,
  exclude,
  disabled,
  onPick,
}: {
  id: string;
  label: string;
  value: ModelId;
  exclude: ModelId;
  disabled: boolean;
  onPick(m: ModelId): void;
}) {
  const canChange = useCanChangeRoutes();
  return (
    <Select
      id={id}
      aria-label={label}
      value={value}
      disabled={disabled || !canChange}
      title={canChange ? undefined : ADMIN_ONLY}
      aria-describedby={canChange ? undefined : 'routes-read-only'}
      onChange={(e) => {
        const m = ModelId.safeParse(e.target.value);
        if (m.success && m.data !== value) onPick(m.data);
      }}
      className="w-full max-w-60"
    >
      {MODELS.map((m) => (
        <option key={m.id} value={m.id} disabled={m.id === exclude}>
          {m.displayName}
          {m.id === exclude ? ' (in use as the other model)' : ''}
        </option>
      ))}
    </Select>
  );
}

/**
 * S4 feature list (FR-16, FR-17). The pickers always show the confirmed route: picking a model
 * only opens the review step (FR-18); the row shows the new route after the gateway confirms.
 */
export function RoutingTable({ rules }: { rules: RoutingRule[] }) {
  const review = useGatewayState((s) => s.review);
  const confirming = useGatewayState((s) => s.confirming);
  const errors = useGatewayState((s) => s.changeErrors);
  const order = (r: RoutingRule) => FEATURES.findIndex((f) => f.id === r.featureId);
  const sorted = [...rules].sort((a, b) => order(a) - order(b));

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Feature
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Team
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Main model
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Backup model
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Last updated
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const f = getFeature(r.featureId);
            const applying = confirming && review?.featureId === r.featureId;
            const error = errors[r.featureId];
            return (
              <tr key={r.featureId} className="border-b last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {f.displayName}
                </th>
                <td className="px-4 py-3 text-muted-foreground">{f.team}</td>
                <td className="px-4 py-3">
                  <ModelPicker
                    id={`main-${r.featureId}`}
                    label={`Main model for ${f.displayName}`}
                    value={r.mainModelId}
                    exclude={r.fallbackModelId}
                    disabled={applying}
                    onPick={(m) =>
                      openReview({
                        featureId: r.featureId,
                        mainModelId: m,
                        fallbackModelId: r.fallbackModelId,
                        source: 'click',
                      })
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <ModelPicker
                    id={`backup-${r.featureId}`}
                    label={`Backup model for ${f.displayName}`}
                    value={r.fallbackModelId}
                    exclude={r.mainModelId}
                    disabled={applying}
                    onPick={(m) =>
                      openReview({
                        featureId: r.featureId,
                        mainModelId: r.mainModelId,
                        fallbackModelId: m,
                        source: 'click',
                      })
                    }
                  />
                </td>
                <td className="px-4 py-3" aria-live="polite">
                  {applying ? (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Applying… waiting for
                      gateway
                    </span>
                  ) : error ? (
                    <span className="inline-flex items-start gap-1.5 text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>
                        Not changed: {error} {f.displayName} still uses {modelName(r.mainModelId)}.
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{formatDateTime(r.updatedAt)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
