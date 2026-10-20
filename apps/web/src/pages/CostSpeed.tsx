import type { Model, TimeRange } from '@gateway/contracts';
import { BarChart3 } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Segmented } from '@/components/ui/segmented';
import { LatencyChart, SpendChart } from '@/features/cost/charts';
import { Breakdown, Card, countWithShare, Kpi, PriceTable } from '@/features/cost/parts';
import { useGateway } from '@/gateway';
import { formatInt, formatUsd, modelName } from '@/lib/format';
import { aggregates, useRequests } from '@/store';

type Range = Extract<TimeRange, '5m' | '1h' | 'all'>;

const RANGES = [
  { value: '5m', label: 'Last 5 min' },
  { value: '1h', label: 'Last hour' },
  { value: 'all', label: 'All data' },
] as const satisfies readonly { value: Range; label: string }[];

const RANGE_NOTE: Record<Range, string> = {
  '5m': 'Last 5 minutes',
  '1h': 'Last hour',
  all: 'All data',
};

function bucketLabel(ms: number) {
  return ms < 60_000
    ? `Per ${ms / 1000} seconds`
    : ms === 60_000
      ? 'Per minute'
      : `Per ${ms / 60_000} minutes`;
}

/** S3: Cost & Speed (FR-10..FR-15). Lazy-loaded so ECharts stays off the landing screen (NFR-4). */
export default function CostSpeedPage() {
  const client = useGateway();
  const [range, setRange] = useState<Range>('1h');
  const [models, setModels] = useState<Model[] | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const version = useRequests((s) => s.version);
  const load = useRequests((s) => s.load);
  const loadError = useRequests((s) => s.loadError);

  useEffect(() => {
    let live = true;
    client
      .getModels()
      .then((m) => live && setModels(m))
      .catch(
        (e: unknown) =>
          live && setModelsError(e instanceof Error ? e.message : 'Could not load prices'),
      );
    return () => {
      live = false;
    };
  }, [client]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute when a batch is applied
  const s = useMemo(() => aggregates.query(range, Date.now()), [range, version]);

  const header = (
    <PageHeader
      title="Cost & Speed"
      intro="What your AI traffic costs and how fast it answers, by model and by feature."
      actions={
        <Segmented<Range> label="Time range" value={range} options={RANGES} onChange={setRange} />
      }
    />
  );

  let body: ReactNode;
  if (load === 'error' && s.count === 0) {
    body = (
      <ErrorState
        title="Could not load requests"
        text={loadError ?? 'The gateway did not answer.'}
      />
    );
  } else if (load !== 'ready' && s.count === 0) {
    body = <LoadingState label="Loading cost and speed…" />;
  } else if (s.count === 0) {
    body = (
      <EmptyState
        icon={BarChart3}
        title="No requests in this time range"
        text="Pick a wider time range, or wait for new traffic."
      />
    );
  } else {
    const failed = countWithShare(s.failed, s.count);
    const fallback = countWithShare(s.fallback, s.count);
    body = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Total spend" value={formatUsd(s.spend)} note={RANGE_NOTE[range]} />
          <Kpi
            label="Requests"
            value={formatInt(s.count)}
            note={`About ${s.ratePerSec.toFixed(1)} per second`}
          />
          <Kpi label="Failed" icon="failed" {...failed} note="Nothing answered" />
          <Kpi label="Fallbacks" icon="fallback" {...fallback} note="Backup model answered" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Spend over time" aside={bucketLabel(s.bucketMs)}>
            <SpendChart series={s.series} label={RANGE_NOTE[range]} />
          </Card>
          <Card title="Latency over time" aside={bucketLabel(s.bucketMs)}>
            <LatencyChart series={s.series} label={RANGE_NOTE[range]} />
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Spend by model">
            <Breakdown
              tone="primary"
              total={s.spend}
              items={s.byModel.map((m) => ({ label: modelName(m.id), spend: m.spend }))}
            />
          </Card>
          <Card title="Spend by feature">
            <Breakdown
              tone="neutral"
              total={s.spend}
              items={s.byFeature.map((f) => ({ label: f.id, spend: f.spend }))}
            />
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      {body}
      <Card
        title="Model prices"
        aside={<span className="rounded-md bg-muted px-2 py-1">Example prices, per 1M tokens</span>}
        className="p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-5"
      >
        {modelsError ? (
          <p role="alert" className="px-5 pb-5 text-destructive">
            {modelsError}
          </p>
        ) : models ? (
          <PriceTable models={models} />
        ) : (
          <p className="px-5 pb-5 text-muted-foreground">Loading prices…</p>
        )}
      </Card>
    </div>
  );
}
