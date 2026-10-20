import { z } from 'zod';

/** Data entities from spec §4, with ids fixed by D13.2 and D13.3. */

export const Role = z.enum(['viewer', 'admin']);
export type Role = z.infer<typeof Role>;

export const User = z.object({
  name: z.string().trim().min(1).max(60),
  role: Role,
});
export type User = z.infer<typeof User>;

export const ModelId = z.enum([
  'claude-opus',
  'claude-sonnet',
  'claude-haiku',
  'grok',
  'gpt',
  'gemini',
  'self-hosted',
]);
export type ModelId = z.infer<typeof ModelId>;

export const Model = z.object({
  id: ModelId,
  displayName: z.string(),
  provider: z.string(),
  inputPricePerMillion: z.number().nonnegative(),
  outputPricePerMillion: z.number().nonnegative(),
});
export type Model = z.infer<typeof Model>;

export const FeatureId = z.enum([
  'support-bot',
  'code-review',
  'search-summary',
  'invoice-reader',
  'onboarding-helper',
]);
export type FeatureId = z.infer<typeof FeatureId>;

export const Team = z.enum([
  'Customer Support',
  'Developer Platform',
  'Search',
  'Payments',
  'Growth',
]);
export type Team = z.infer<typeof Team>;

export const Feature = z.object({
  id: FeatureId,
  displayName: z.string(),
  team: Team,
});
export type Feature = z.infer<typeof Feature>;

export const RoutingRule = z.object({
  featureId: FeatureId,
  mainModelId: ModelId,
  fallbackModelId: ModelId,
  /** ISO 8601. */
  updatedAt: z.string(),
});
export type RoutingRule = z.infer<typeof RoutingRule>;

export const RequestStatus = z.enum(['success', 'failed', 'fallback']);
export type RequestStatus = z.infer<typeof RequestStatus>;

export const ErrorReason = z.enum(['timeout', 'rate limit', 'server error']);
export type ErrorReason = z.infer<typeof ErrorReason>;

/**
 * One AI request (spec §4 Request, D13.7).
 * - `fallback`: planned model failed with `errorReason`, backup answered; cost and tokens are the
 *   served model's, latency includes the failed attempt.
 * - `failed`: nothing answered; `servedModelId` is null, cost and output tokens are 0.
 */
export const GatewayRequest = z.object({
  id: z.string(),
  /** Epoch milliseconds. */
  timestamp: z.number().int(),
  featureId: FeatureId,
  team: Team,
  plannedModelId: ModelId,
  servedModelId: ModelId.nullable(),
  status: RequestStatus,
  latencyMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cost: z.number().nonnegative(),
  errorReason: ErrorReason.nullable(),
});
export type GatewayRequest = z.infer<typeof GatewayRequest>;

export const ChangeSource = z.enum(['click', 'chat', 'undo']);
export type ChangeSource = z.infer<typeof ChangeSource>;

export const RouteChange = z.object({
  id: z.string(),
  /** ISO 8601, when it was confirmed. */
  timestamp: z.string(),
  changedBy: z.string(),
  featureId: FeatureId,
  oldMainModelId: ModelId,
  newMainModelId: ModelId,
  oldFallbackModelId: ModelId,
  newFallbackModelId: ModelId,
  source: ChangeSource,
  /** Negative = cheaper. Null when there was no traffic to estimate from. */
  estimatedCostChangePercent: z.number().nullable(),
});
export type RouteChange = z.infer<typeof RouteChange>;
