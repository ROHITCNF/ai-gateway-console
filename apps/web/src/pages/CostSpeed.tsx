import { useMemo } from 'react';
import { readChartTheme } from '@/charts/theme';
import { useEChart } from '@/charts/useEChart';
import { PageHeader } from '@/components/PageHeader';
import { aggregates, useRequests } from '@/store';

/** S3: Cost & Speed. Lazy-loaded so ECharts stays off the landing screen (NFR-4). */
export default function CostSpeedPage() {
  const version = useRequests((s) => s.version);
  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute when new data is applied
  const summary = useMemo(() => aggregates.query('1h', Date.now()), [version]);
  const option = useMemo(() => {
    const t = readChartTheme();
    return {
      animation: false,
      grid: { left: 48, right: 16, top: 16, bottom: 28 },
      xAxis: { type: 'time', axisLabel: { color: t.muted } },
      yAxis: {
        type: 'value',
        axisLabel: { color: t.muted },
        splitLine: { lineStyle: { color: t.grid } },
      },
      series: [
        {
          type: 'line',
          showSymbol: false,
          color: t.primary,
          data: summary.series.map((p) => [p.t, p.spend]),
        },
      ],
    };
  }, [summary]);
  const ref = useEChart(option);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cost & Speed"
        intro="What your AI traffic costs and how fast it answers, by model and by feature."
      />
      <div ref={ref} className="h-64 rounded-xl border bg-card" />
    </div>
  );
}
