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

const srgb = (x: number) => {
  const c = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
};

/**
 * ECharts cannot parse `oklch()`: it derives hover colours from the series colour, gets
 * `undefined` and draws the line with no colour. Convert tokens to `rgb()` first.
 * Other formats pass through unchanged.
 */
export function toRgb(color: string): string {
  const m = color.match(
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/i,
  );
  if (!m) return color;
  const L = Number(m[1]) / (m[2] ? 100 : 1);
  const C = Number(m[3]);
  const h = (Number(m[4]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = srgb(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
  const g = srgb(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
  const bl = srgb(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);
  if (m[5] === undefined) return `rgb(${r}, ${g}, ${bl})`;
  const alpha = Number(m[5]) / (m[6] ? 100 : 1);
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

export function readChartTheme(el: Element = document.documentElement): ChartTheme {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) =>
    toRgb(css.getPropertyValue(name).trim() || fallback);
  return {
    primary: v('--chart-1', FALLBACK.primary),
    secondary: v('--chart-2', FALLBACK.secondary),
    text: v('--foreground', FALLBACK.text),
    muted: v('--muted-foreground', FALLBACK.muted),
    grid: v('--border', FALLBACK.grid),
    surface: v('--card', FALLBACK.surface),
  };
}
