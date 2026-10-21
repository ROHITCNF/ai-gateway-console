import { color } from 'echarts/core';
import { describe, expect, it } from 'vitest';
import { readChartTheme, toRgb } from './theme';

describe('chart theme colours (D14.1)', () => {
  it('converts oklch tokens to rgb', () => {
    expect(toRgb('oklch(1 0 0)')).toBe('rgb(255, 255, 255)');
    expect(toRgb('oklch(0 0 0)')).toBe('rgb(0, 0, 0)');
    expect(toRgb('oklch(62.8% 0.2577 29.23)')).toBe('rgb(255, 0, 0)');
    expect(toRgb('oklch(1 0 0 / 50%)')).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('passes other formats through', () => {
    expect(toRgb('#2563eb')).toBe('#2563eb');
  });

  it('gives ECharts colours it can derive hover colours from', () => {
    document.documentElement.style.setProperty('--chart-1', 'oklch(0.55 0.22 263)');
    const t = readChartTheme();
    expect(t.primary).toMatch(/^rgb\(/);
    expect(color.lift(t.primary, -0.1)).toBeDefined();
  });
});
