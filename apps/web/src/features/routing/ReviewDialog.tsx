import type { ChangeSource, EstimateResponse } from '@gateway/contracts';
import { getFeature } from '@gateway/contracts';
import { AlertCircle, ArrowRight, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useGateway } from '@/gateway';
import { modelName } from '@/lib/format';
import { cn } from '@/lib/utils';
import { cancelReview, confirmReview, useGatewayState } from '@/store';

const SOURCE_LABEL: Record<ChangeSource, string> = {
  click: 'Picked on Routing',
  chat: 'Suggested via chat',
  undo: 'Undo',
};

/** "About 80% cheaper" etc. from the backend estimate (FR-18, D13.10). */
export function describeEstimate(e: EstimateResponse, feature: string) {
  const basis =
    e.basis === 'last_hour'
      ? `Estimated from ${feature}’s last hour of traffic (${e.sampleSize.toLocaleString()} requests).`
      : `Estimated from all of ${feature}’s traffic (${e.sampleSize.toLocaleString()} requests), because the last hour had fewer than 50.`;
  if (e.percent === null)
    return {
      headline: 'No estimate yet',
      basis: `${feature} has no traffic to estimate from.`,
      tone: 'neutral' as const,
    };
  if (e.percent === 0) return { headline: 'About the same cost', basis, tone: 'neutral' as const };
  if (e.percent < 0)
    return { headline: `About ${Math.abs(e.percent)}% cheaper`, basis, tone: 'down' as const };
  return { headline: `About ${e.percent}% more expensive`, basis, tone: 'up' as const };
}

function Change({ label, from, to }: { label: string; from: string; to: string }) {
  const same = from === to;
  return (
    <div className="grid grid-cols-[5rem_1fr_auto_1fr] items-center gap-3 px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{from}</span>
      <ArrowRight className="size-4 text-muted-foreground" aria-label="changes to" />
      <span className={cn(!same && 'font-semibold', same && 'text-muted-foreground')}>
        {same ? 'No change' : to}
      </span>
    </div>
  );
}

/**
 * S5: the one review step every route change goes through (FR-18, FR-19). Nothing changes until
 * Confirm; Cancel or Esc closes with no change. Busy and error states per FR-32.
 */
export function ReviewDialog() {
  const client = useGateway();
  const review = useGatewayState((s) => s.review);
  const confirming = useGatewayState((s) => s.confirming);
  const error = useGatewayState((s) => s.reviewError);
  const current = useGatewayState((s) =>
    s.rules.data?.find((r) => r.featureId === review?.featureId),
  );
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  useEffect(() => {
    setEstimate(null);
    setEstimateError(null);
    if (!review) return;
    let live = true;
    client
      .estimate({
        featureId: review.featureId,
        mainModelId: review.mainModelId,
        fallbackModelId: review.fallbackModelId,
      })
      .then((e) => live && setEstimate(e))
      .catch(
        (e: unknown) => live && setEstimateError(e instanceof Error ? e.message : 'No estimate'),
      );
    return () => {
      live = false;
    };
  }, [client, review]);

  if (!review) return null;
  const feature = getFeature(review.featureId);
  const est = estimate ? describeEstimate(estimate, feature.displayName) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && cancelReview()}>
      <DialogContent
        onEscapeKeyDown={(e) => confirming && e.preventDefault()}
        onPointerDownOutside={(e) => confirming && e.preventDefault()}
      >
        <div className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-semibold">Review route change</DialogTitle>
              <DialogDescription className="mt-1 text-muted-foreground">
                {feature.displayName} · {feature.team} team
              </DialogDescription>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
              {SOURCE_LABEL[review.source]}
            </span>
          </div>

          <div className="divide-y rounded-lg border">
            <Change
              label="Main"
              from={modelName(current?.mainModelId ?? null)}
              to={modelName(review.mainModelId)}
            />
            <Change
              label="Backup"
              from={modelName(current?.fallbackModelId ?? null)}
              to={modelName(review.fallbackModelId)}
            />
          </div>

          <div className="flex gap-3 rounded-lg bg-primary/5 p-4 text-sm" aria-live="polite">
            {est?.tone === 'down' && (
              <TrendingDown className="mt-0.5 size-5 text-primary" aria-hidden />
            )}
            {est?.tone === 'up' && (
              <TrendingUp className="mt-0.5 size-5 text-warning" aria-hidden />
            )}
            <div>
              {est ? (
                <>
                  <p className="text-base font-semibold">{est.headline}</p>
                  <p className="mt-0.5 text-muted-foreground">{est.basis}</p>
                </>
              ) : estimateError ? (
                <p className="text-muted-foreground">
                  Could not estimate the cost change: {estimateError}
                </p>
              ) : (
                <p className="text-muted-foreground">Estimating cost change…</p>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            The gateway uses the new route from the next request. You can undo it later from
            History.
          </p>

          {error && (
            <div
              role="alert"
              className="flex gap-2 rounded-lg border border-destructive/30 bg-danger-soft p-3 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="font-semibold">The gateway didn’t accept this change</p>
                <p>
                  {error} {feature.displayName} still uses {modelName(current?.mainModelId ?? null)}
                  . Nothing was changed.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <Button variant="outline" onClick={cancelReview} disabled={confirming}>
            Cancel
          </Button>
          <Button
            onClick={() => void confirmReview(client)}
            disabled={confirming}
            aria-busy={confirming}
          >
            {confirming && <Loader2 className="animate-spin" aria-hidden />}
            {confirming ? 'Applying…' : error ? 'Try again' : 'Confirm change'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
