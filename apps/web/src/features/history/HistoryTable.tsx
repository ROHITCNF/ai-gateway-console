import type { ChangeSource, ModelId, RouteChange } from '@gateway/contracts';
import type { ReactNode } from 'react';
import { formatDateTime, modelName } from '@/lib/format';

const SOURCE: Record<ChangeSource, string> = { click: 'Click', chat: 'Via chat', undo: 'Undo' };

function Diff({ from, to }: { from: ModelId; to: ModelId }) {
  if (from === to) return <span className="text-muted-foreground">No change</span>;
  return (
    <span>
      {modelName(from)} → {modelName(to)}
    </span>
  );
}

export function formatEstimate(p: number | null): string {
  if (p === null) return '—';
  return `${p > 0 ? '+' : p < 0 ? '−' : '+'}${Math.abs(p)}%`;
}

/** S6 change list, newest first (FR-22). `action` renders the per-row Undo slot (FR-23). */
export function HistoryTable({
  changes,
  action,
}: {
  changes: RouteChange[];
  action?: (c: RouteChange) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Time
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Changed by
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Feature
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Main model
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Backup model
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium">
              Source
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Est. cost change
            </th>
            {action && (
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.id} className="border-b last:border-0">
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {formatDateTime(c.timestamp)}
              </td>
              <td className="px-4 py-3">{c.changedBy}</td>
              <td className="px-4 py-3 font-medium">{c.featureId}</td>
              <td className="px-4 py-3">
                <Diff from={c.oldMainModelId} to={c.newMainModelId} />
              </td>
              <td className="px-4 py-3">
                <Diff from={c.oldFallbackModelId} to={c.newFallbackModelId} />
              </td>
              <td className="px-4 py-3">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                  {SOURCE[c.source]}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatEstimate(c.estimatedCostChangePercent)}
              </td>
              {action && <td className="px-4 py-3 text-right">{action(c)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
