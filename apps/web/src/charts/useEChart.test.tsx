import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const instance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
vi.mock('./echarts', () => ({ echarts: { init: vi.fn(() => instance) } }));

const { echarts } = await import('./echarts');
const { useEChart } = await import('./useEChart');

function Chart({ option }: { option: Record<string, unknown> }) {
  const ref = useEChart(option);
  return <div ref={ref} />;
}

describe('useEChart (D14.1)', () => {
  it('inits once, updates the option and disposes on unmount', () => {
    const a = { series: [{ data: [1] }] };
    const b = { series: [{ data: [2] }] };
    const { rerender, unmount } = render(<Chart option={a} />);
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(instance.setOption).toHaveBeenLastCalledWith(a, { lazyUpdate: true });
    rerender(<Chart option={b} />);
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(instance.setOption).toHaveBeenLastCalledWith(b, { lazyUpdate: true });
    unmount();
    expect(instance.dispose).toHaveBeenCalledTimes(1);
  });
});
