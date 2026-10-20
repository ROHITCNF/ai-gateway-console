import { getModel } from './catalog';
import type { Model, ModelId } from './entities';

/**
 * Cost in USD of one request: tokens priced at the model's per-1M rates (spec §4 Request.cost).
 * Rounded to 1e-8 so sums stay stable.
 */
export function cost(model: ModelId | Model, inputTokens: number, outputTokens: number): number {
  if (inputTokens < 0 || outputTokens < 0) throw new RangeError('Token counts must be >= 0');
  const m = typeof model === 'string' ? getModel(model) : model;
  const usd = (inputTokens * m.inputPricePerMillion + outputTokens * m.outputPricePerMillion) / 1e6;
  return Math.round(usd * 1e8) / 1e8;
}
