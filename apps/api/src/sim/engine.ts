import {
  cost,
  type ErrorReason,
  FEATURES,
  type FeatureId,
  type GatewayRequest,
  getFeature,
  type ModelId,
} from '@gateway/contracts';
import type { Rng } from './rng';

/** Current route per feature, as the simulator reads it. */
export type RuleMap = Record<FeatureId, { mainModelId: ModelId; fallbackModelId: ModelId }>;

/** Chance a single model attempt fails (D2: 3–5% of requests). */
export const ATTEMPT_FAILURE_RATE = 0.04;
/** Chance the backup also fails once the main one has, so some rows end `failed`. */
export const BACKUP_FAILURE_RATE = 0.25;

/** Speed by model (D2): bigger = slower. Base ms plus ms per output token. */
const SPEED: Record<ModelId, { baseMs: number; msPerToken: number }> = {
  'claude-opus': { baseMs: 900, msPerToken: 1.4 },
  'claude-sonnet': { baseMs: 600, msPerToken: 0.9 },
  'claude-haiku': { baseMs: 250, msPerToken: 0.35 },
  gpt: { baseMs: 550, msPerToken: 0.8 },
  gemini: { baseMs: 400, msPerToken: 0.6 },
  grok: { baseMs: 600, msPerToken: 0.9 },
  'self-hosted': { baseMs: 350, msPerToken: 0.5 },
};

/** Request size by feature (D2): token ranges and share of traffic. */
const TRAFFIC: Record<
  FeatureId,
  { weight: number; input: [number, number]; output: [number, number] }
> = {
  'support-bot': { weight: 35, input: [800, 2500], output: [200, 800] },
  'code-review': { weight: 20, input: [3000, 8000], output: [300, 1200] },
  'search-summary': { weight: 20, input: [400, 1200], output: [100, 400] },
  'invoice-reader': { weight: 15, input: [1500, 4000], output: [100, 300] },
  'onboarding-helper': { weight: 10, input: [300, 1000], output: [100, 500] },
};

const TIMEOUT_MS = 10_000;
const totalWeight = FEATURES.reduce((sum, f) => sum + TRAFFIC[f.id].weight, 0);

function pickFeature(rng: Rng): FeatureId {
  let r = rng.next() * totalWeight;
  for (const f of FEATURES) {
    r -= TRAFFIC[f.id].weight;
    if (r < 0) return f.id;
  }
  return FEATURES[FEATURES.length - 1]?.id ?? 'support-bot';
}

function pickReason(rng: Rng): ErrorReason {
  const r = rng.next();
  return r < 0.5 ? 'timeout' : r < 0.8 ? 'rate limit' : 'server error';
}

/** How long a failed attempt took before the gateway gave up. */
function failedAttemptMs(rng: Rng, reason: ErrorReason): number {
  if (reason === 'timeout') return TIMEOUT_MS;
  if (reason === 'rate limit') return rng.int(40, 200);
  return rng.int(200, 900);
}

function answerMs(rng: Rng, model: ModelId, outputTokens: number): number {
  const s = SPEED[model];
  const jitter = 0.75 + rng.next() * 0.5 + (rng.next() < 0.05 ? rng.next() * 2 : 0);
  return Math.round((s.baseMs + s.msPerToken * outputTokens) * jitter);
}

function makeId(rng: Rng, timestamp: number): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += Math.floor(rng.next() * 36).toString(36);
  return `req_${timestamp.toString(36)}${suffix}`;
}

/**
 * One simulated request at `timestamp`, following `rules` (D2, D13.7):
 * main answers → `success`; main fails, backup answers → `fallback`
 * (backup's tokens and cost, latency includes the failed attempt);
 * both fail → `failed` (cost 0, no served model).
 */
export function generateRequest(
  rng: Rng,
  timestamp: number,
  rules: RuleMap,
  featureId: FeatureId = pickFeature(rng),
): GatewayRequest {
  const rule = rules[featureId];
  const traffic = TRAFFIC[featureId];
  const id = makeId(rng, timestamp);
  const inputTokens = rng.int(...traffic.input);
  const outputTokens = rng.int(...traffic.output);
  const base = {
    id,
    timestamp,
    featureId,
    team: getFeature(featureId).team,
    plannedModelId: rule.mainModelId,
    inputTokens,
  };

  if (rng.next() >= ATTEMPT_FAILURE_RATE) {
    return {
      ...base,
      servedModelId: rule.mainModelId,
      status: 'success',
      latencyMs: answerMs(rng, rule.mainModelId, outputTokens),
      outputTokens,
      cost: cost(rule.mainModelId, inputTokens, outputTokens),
      errorReason: null,
    };
  }

  const reason = pickReason(rng);
  const firstMs = failedAttemptMs(rng, reason);
  if (rng.next() < BACKUP_FAILURE_RATE) {
    return {
      ...base,
      servedModelId: null,
      status: 'failed',
      latencyMs: firstMs + failedAttemptMs(rng, pickReason(rng)),
      outputTokens: 0,
      cost: 0,
      errorReason: reason,
    };
  }
  return {
    ...base,
    servedModelId: rule.fallbackModelId,
    status: 'fallback',
    latencyMs: firstMs + answerMs(rng, rule.fallbackModelId, outputTokens),
    outputTokens,
    cost: cost(rule.fallbackModelId, inputTokens, outputTokens),
    errorReason: reason,
  };
}

/** `count` requests spread evenly at random over [startMs, endMs), oldest first (D13.4). */
export function generateHistory(
  rng: Rng,
  count: number,
  startMs: number,
  endMs: number,
  rules: RuleMap,
): GatewayRequest[] {
  const times = Array.from({ length: count }, () =>
    Math.floor(startMs + rng.next() * (endMs - startMs)),
  ).sort((a, b) => a - b);
  return times.map((t) => generateRequest(rng, t, rules));
}
