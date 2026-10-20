import { cost, type EstimateResponse, type ModelId } from '@gateway/contracts';

export const ESTIMATE_WINDOW_MS = 3600_000;
export const ESTIMATE_MIN_SAMPLE = 50;

export interface TokenSample {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Estimated cost change of moving a feature's main model (D13.10): the feature's requests from
 * the last hour (all data if fewer than 50), same token counts priced at the new vs old model.
 * Negative = cheaper. Rounded to whole percent.
 */
export function estimateCostChange(
  samples: readonly TokenSample[],
  oldModel: ModelId,
  newModel: ModelId,
  now: number,
): EstimateResponse {
  const recent = samples.filter((s) => s.timestamp >= now - ESTIMATE_WINDOW_MS);
  const useRecent = recent.length >= ESTIMATE_MIN_SAMPLE;
  const basis = useRecent ? 'last_hour' : 'all_data';
  const used = useRecent ? recent : samples;
  let oldCost = 0;
  let newCost = 0;
  for (const s of used) {
    oldCost += cost(oldModel, s.inputTokens, s.outputTokens);
    newCost += cost(newModel, s.inputTokens, s.outputTokens);
  }
  const percent = oldCost > 0 ? Math.round(((newCost - oldCost) / oldCost) * 100) : null;
  return { percent, basis, sampleSize: used.length };
}
