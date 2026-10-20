import type { GatewayRequest } from '@gateway/contracts';
import { ArrowRight, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { formatCost, formatDateTime, formatInt, formatMs, modelName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { explainRequest } from './explain';
import { StatusBadge } from './StatusBadge';

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 tabular-nums">{children}</dd>
    </div>
  );
}

/** S2a: everything about one request (FR-7, FR-8). Esc or the close button closes it. */
export function DetailPanel({
  request,
  onClose,
}: {
  request: GatewayRequest | null;
  onClose(): void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const openId = request?.id;

  useEffect(() => {
    if (!openId) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, onClose]);

  if (!request) return null;
  const story = explainRequest(request);
  const answered = request.servedModelId !== null;

  return (
    <aside
      aria-labelledby="detail-title"
      className="w-full shrink-0 space-y-5 rounded-xl border bg-card p-5 lg:sticky lg:top-20 lg:w-96 lg:self-start"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="detail-title" className="text-sm text-muted-foreground">
            Request
          </h2>
          <p className="truncate font-mono text-sm">{request.id}</p>
        </div>
        <Button
          ref={closeRef}
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close details"
        >
          <X aria-hidden />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge status={request.status} />
        <span className="text-muted-foreground">{formatDateTime(request.timestamp)}</span>
      </div>

      {story && (
        <div
          className={cn(
            'rounded-lg border p-4 text-sm',
            request.status === 'fallback'
              ? 'border-warning/40 bg-warning-soft'
              : 'border-destructive/30 bg-danger-soft',
          )}
        >
          <p className="font-medium">{story.title}</p>
          <p className="mt-1">{story.text}</p>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-lg border p-4 text-sm">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground">Planned</p>
          <p
            className={cn(
              'font-medium',
              request.status !== 'success' && 'line-through decoration-muted-foreground',
            )}
          >
            {modelName(request.plannedModelId)}
          </p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground">Answered by</p>
          <p className="font-medium">
            {answered ? modelName(request.servedModelId) : 'Nothing answered'}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4">
        <Item label="Feature">{request.featureId}</Item>
        <Item label="Team">{request.team}</Item>
        <Item label="Input tokens">{formatInt(request.inputTokens)}</Item>
        <Item label="Output tokens">{formatInt(request.outputTokens)}</Item>
        <Item label="Latency">{formatMs(request.latencyMs)}</Item>
        <Item label="Cost">{formatCost(request.cost)}</Item>
        {request.errorReason && (
          <div className="col-span-2">
            <Item label={request.status === 'fallback' ? 'Error from planned model' : 'Error'}>
              {request.errorReason}
            </Item>
          </div>
        )}
      </dl>

      {request.status !== 'success' && (
        <p className="border-t pt-4 text-xs text-muted-foreground">
          {request.status === 'fallback'
            ? 'Latency includes the failed attempt. Cost is charged for the model that answered.'
            : 'Latency includes both failed attempts. Failed requests cost nothing.'}
        </p>
      )}
    </aside>
  );
}
