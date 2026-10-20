import type { GatewayRequest } from '@gateway/contracts';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type KeyboardEvent, useRef } from 'react';
import { formatCost, formatInt, formatMs, formatTime, modelName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';

export const ROW_HEIGHT = 44;

const features = tableFeatures({});
const col = createColumnHelper<typeof features, GatewayRequest>();

/** FR-3 columns: time, feature, model used, status, latency, tokens, cost. */
const columns = col.columns([
  col.accessor('timestamp', {
    header: 'Time',
    cell: (c) => <span className="tabular-nums">{formatTime(c.getValue())}</span>,
  }),
  col.accessor('featureId', {
    header: 'Feature',
    cell: (c) => <span className="font-medium">{c.getValue()}</span>,
  }),
  col.display({
    id: 'model',
    header: 'Model used',
    cell: ({ row: { original: r } }) => (
      <span className="truncate">
        {modelName(r.servedModelId)}
        {r.status !== 'success' && (
          <span className="text-muted-foreground"> · planned {modelName(r.plannedModelId)}</span>
        )}
      </span>
    ),
  }),
  col.accessor('status', { header: 'Status', cell: (c) => <StatusBadge status={c.getValue()} /> }),
  col.accessor('latencyMs', {
    header: 'Latency',
    cell: (c) => <span className="tabular-nums">{formatMs(c.getValue())}</span>,
  }),
  col.display({
    id: 'tokens',
    header: 'Tokens',
    cell: ({ row: { original: r } }) => (
      <span className="tabular-nums">
        {r.status === 'failed' ? '—' : formatInt(r.inputTokens + r.outputTokens)}
      </span>
    ),
  }),
  col.accessor('cost', {
    header: 'Cost',
    cell: (c) => <span className="tabular-nums">{formatCost(c.getValue())}</span>,
  }),
]);

const WIDTHS: Record<string, string> = {
  timestamp: 'w-24',
  featureId: 'w-44',
  model: 'w-auto',
  status: 'w-32',
  latencyMs: 'w-28',
  tokens: 'w-24',
  cost: 'w-24',
};
const RIGHT = new Set(['latencyMs', 'tokens', 'cost']);

interface Props {
  rows: GatewayRequest[];
  selectedId: string | null;
  onSelect(id: string): void;
}

/**
 * Virtualised Live Requests table (FR-3, FR-9, NFR-1, D8): only rows on screen are drawn,
 * with spacer rows keeping the scroll height. Arrow keys / Home / End move the selection (NFR-11).
 */
export function RequestTable({ rows: data, selectedId, onSelect }: Props) {
  const scrollRef = useRef<HTMLElement>(null);
  const table = useTable({ features, columns, data, getRowId: (r) => r.id });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (i) => rows[i]?.id ?? i,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const top = items[0]?.start ?? 0;
  const bottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
  const selectedIndex = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1;

  const onKeyDown = (e: KeyboardEvent) => {
    if (rows.length === 0) return;
    let next: number;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, selectedIndex + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, selectedIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else return;
    e.preventDefault();
    const row = rows[next];
    if (row) {
      onSelect(row.id);
      virtualizer.scrollToIndex(next, { align: 'auto' });
    }
  };

  return (
    <section
      ref={scrollRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the scroll region owns keyboard row selection
      tabIndex={0}
      aria-label="Requests table. Use arrow keys to select a row."
      onKeyDown={onKeyDown}
      className="h-[calc(100vh-24rem)] min-h-80 overflow-auto rounded-xl border bg-card text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <table
        className="w-full table-fixed border-separate border-spacing-0"
        aria-rowcount={rows.length + 1}
      >
        <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((h) => (
                <th
                  key={h.id}
                  scope="col"
                  className={cn(
                    'h-11 border-b px-4 text-left font-medium',
                    WIDTHS[h.column.id],
                    RIGHT.has(h.column.id) && 'text-right',
                  )}
                >
                  <table.FlexRender header={h} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {top > 0 && (
            <tr aria-hidden style={{ height: top }}>
              <td colSpan={columns.length} />
            </tr>
          )}
          {items.map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            const selected = row.id === selectedId;
            return (
              <tr
                key={row.id}
                aria-rowindex={item.index + 2}
                aria-selected={selected}
                data-request-id={row.id}
                onClick={() => onSelect(row.id)}
                className={cn(
                  'cursor-pointer hover:bg-accent/60',
                  selected && 'bg-primary/10 hover:bg-primary/10',
                )}
                style={{ height: ROW_HEIGHT }}
              >
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      'truncate border-b border-border/60 px-4',
                      RIGHT.has(cell.column.id) && 'text-right',
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            );
          })}
          {bottom > 0 && (
            <tr aria-hidden style={{ height: bottom }}>
              <td colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
