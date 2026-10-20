import { getModel, type ModelId } from '@gateway/contracts';

const time = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
const int = new Intl.NumberFormat();

export const formatTime = (ms: number) => time.format(ms);
export const formatDateTime = (ms: number | string) => dateTime.format(new Date(ms));
export const formatInt = (n: number) => int.format(n);
export const formatMs = (ms: number) => `${int.format(ms)} ms`;

/** Per-request costs are tiny; show 4 decimals. Totals use `formatUsd`. */
export const formatCost = (usd: number) => `$${usd.toFixed(4)}`;
export const formatUsd = (usd: number) =>
  `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatPercent = (p: number, digits = 1) => `${p.toFixed(digits)}%`;

export const modelName = (id: ModelId | null) => (id ? getModel(id).displayName : '—');
