import type { ReactNode } from 'react';

/** Title plus the one-sentence explanation every screen starts with (NFR-9). */
export function PageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-muted-foreground">{intro}</p>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
