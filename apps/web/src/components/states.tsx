import { AlertCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Shared loading / empty / error states for every screen (NFR-12). */

export function LoadingState({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <div role="status" className="rounded-xl border bg-card p-6">
      <p className="text-muted-foreground">{label}</p>
      <div className="mt-4 space-y-3" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder bars
            key={i}
            className="h-3 animate-pulse rounded bg-muted"
            style={{ width: `${85 - ((i * 13) % 30)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-14 text-center">
      <Icon className="size-6 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  text,
  onRetry,
}: {
  title: string;
  text: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-card p-5">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-muted-foreground">{text}</p>
        {onRetry && (
          <Button variant="outline" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
