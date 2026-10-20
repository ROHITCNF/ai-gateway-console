/** Chart colours come from the Tailwind/shadcn tokens in index.css (D14.1). */
export interface ChartTheme {
  primary: string;
  secondary: string;
  text: string;
  muted: string;
  grid: string;
  surface: string;
}

const FALLBACK: ChartTheme = {
  primary: '#2563eb',
  secondary: '#c2410c',
  text: '#1e293b',
  muted: '#64748b',
  grid: '#e2e8f0',
  surface: '#ffffff',
};

export function readChartTheme(el: Element = document.documentElement): ChartTheme {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    primary: v('--chart-1', FALLBACK.primary),
    secondary: v('--chart-2', FALLBACK.secondary),
    text: v('--foreground', FALLBACK.text),
    muted: v('--muted-foreground', FALLBACK.muted),
    grid: v('--border', FALLBACK.grid),
    surface: v('--card', FALLBACK.surface),
  };
}
