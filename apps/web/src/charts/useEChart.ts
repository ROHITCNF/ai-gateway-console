import { useEffect, useRef } from 'react';
import { type EChartsCoreOption, echarts } from './echarts';

/**
 * Owns one ECharts instance: init on mount, `setOption` when the option changes, resize with
 * the container, dispose on unmount (D14.1). Returns the ref for the container element.
 */
export function useEChart<T extends HTMLElement = HTMLDivElement>(option: EChartsCoreOption) {
  const ref = useRef<T>(null);
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const instance = echarts.init(el, undefined, { renderer: 'canvas' });
    chart.current = instance;
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instance.resize());
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    // Live data: merge into the existing chart without animation so 250 ms updates stay cheap.
    chart.current?.setOption(option, { lazyUpdate: true });
  }, [option]);

  return ref;
}
