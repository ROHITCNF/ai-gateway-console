import type { Model } from '@gateway/contracts';
import { CornerDownRight, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatInt, formatPercent, formatUsd } from '@/lib/format';
import { cn } from '@/lib/utils';

export function Card({
  title,
  aside,
  children,
  className,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border bg-card p-5', className)}>
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  extra,
  note,
  icon,
}: {
  label: string;
  value: string;
  extra?: string;
  note: string;
  icon?: 'failed' | 'fallback';
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon === 'failed' && <X className="size-4 text-destructive" aria-hidden />}
        {icon === 'fallback' && <CornerDownRight className="size-4 text-warning" aria-hidden />}
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">
        {value}
        {extra && (
          <span className="ml-1.5 text-lg font-medium text-muted-foreground">· {extra}</span>
        )}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

/** Spend split as plain CSS bars (D14.1). */
export function Breakdown({
  items,
  total,
  tone,
}: {
  items: { label: string; spend: number }[];
  total: number;
  tone: 'primary' | 'neutral';
}) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">No spend in this range.</p>;
  const max = Math.max(...items.map((i) => i.spend), 0.000001);
  return (
    <ul className="space-y-3">
      {items.map((i) => {
        const share = total > 0 ? (i.spend / total) * 100 : 0;
        return (
          <li key={i.label} className="grid grid-cols-[9rem_1fr_9rem] items-center gap-4 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="h-2 rounded-full bg-muted" aria-hidden>
              <span
                className={cn(
                  'block h-2 rounded-full',
                  tone === 'primary' ? 'bg-chart-1' : 'bg-chart-3',
                )}
                style={{ width: `${Math.max(1, (i.spend / max) * 100)}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              {formatUsd(i.spend)} · {formatPercent(share, 0)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const money = (n: number) => `$${n.toFixed(2)}`;

/** FR-10: example prices per 1M tokens, read from the gateway API (D3). */
export function PriceTable({ models }: { models: Model[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Model
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Provider
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Input
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Output
            </th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id} className="border-t">
              <td className="px-4 py-2.5 font-medium">{m.displayName}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{m.provider}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {money(m.inputPricePerMillion)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {money(m.outputPricePerMillion)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const countWithShare = (n: number, total: number) => ({
  value: formatInt(n),
  extra: formatPercent(total > 0 ? (n / total) * 100 : 0),
});
