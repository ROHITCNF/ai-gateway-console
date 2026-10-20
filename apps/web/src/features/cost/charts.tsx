import { useMemo } from 'react';
import { readChartTheme } from '@/charts/theme';
import { useEChart } from '@/charts/useEChart';
import type { SeriesPoint } from '@/store';

const usd = (v: number) => `$${v < 1 ? v.toFixed(3) : v.toFixed(2)}`;
const secs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

function base(t: ReturnType<typeof readChartTheme>) {
  return {
    animation: false,
    grid: { left: 56, right: 16, top: 16, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: t.surface,
      borderColor: t.grid,
      textStyle: { color: t.text },
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: t.muted, hideOverlap: true },
      axisLine: { lineStyle: { color: t.grid } },
      splitLine: { show: false },
    },
  };
}

/** Spend over time (FR-12), from time-bucket aggregates (D8). */
export function SpendChart({ series, label }: { series: SeriesPoint[]; label: string }) {
  const option = useMemo(() => {
    const t = readChartTheme();
    return {
      ...base(t),
      yAxis: {
        type: 'value',
        axisLabel: { color: t.muted, formatter: usd },
        splitLine: { lineStyle: { color: t.grid } },
      },
      series: [
        {
          name: 'Spend',
          type: 'line',
          showSymbol: false,
          color: t.primary,
          areaStyle: { opacity: 0.08 },
          tooltip: { valueFormatter: usd },
          data: series.map((p) => [p.t, p.spend]),
        },
      ],
    };
  }, [series]);
  const ref = useEChart(option);
  return (
    <div ref={ref} role="img" aria-label={`Spend over time, ${label}`} className="h-64 w-full" />
  );
}

/** Latency over time: typical (p50) and slow (p95) lines (FR-13). */
export function LatencyChart({ series, label }: { series: SeriesPoint[]; label: string }) {
  const option = useMemo(() => {
    const t = readChartTheme();
    return {
      ...base(t),
      legend: { top: 0, right: 0, textStyle: { color: t.muted }, itemWidth: 18 },
      grid: { left: 56, right: 16, top: 32, bottom: 28 },
      yAxis: {
        type: 'value',
        axisLabel: { color: t.muted, formatter: secs },
        splitLine: { lineStyle: { color: t.grid } },
      },
      series: [
        {
          name: 'Typical (p50)',
          type: 'line',
          showSymbol: false,
          connectNulls: true,
          color: t.primary,
          tooltip: { valueFormatter: (v: number) => (v == null ? '—' : secs(v)) },
          data: series.map((p) => [p.t, p.p50]),
        },
        {
          name: 'Slow (p95)',
          type: 'line',
          showSymbol: false,
          connectNulls: true,
          color: t.secondary,
          lineStyle: { type: 'dashed' },
          tooltip: { valueFormatter: (v: number) => (v == null ? '—' : secs(v)) },
          data: series.map((p) => [p.t, p.p95]),
        },
      ],
    };
  }, [series]);
  const ref = useEChart(option);
  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Latency p50 and p95 over time, ${label}`}
      className="h-64 w-full"
    />
  );
}
