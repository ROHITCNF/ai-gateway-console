import type { FeatureId, ModelId } from '@gateway/contracts';
import type { Db } from './client';
import { routingRules } from './schema';

/** Starting routes. support-bot starts on the expensive model so Flow C has something to save. */
export const DEFAULT_RULES: Record<FeatureId, { main: ModelId; fallback: ModelId }> = {
  'support-bot': { main: 'claude-opus', fallback: 'claude-sonnet' },
  'code-review': { main: 'claude-sonnet', fallback: 'gpt' },
  'search-summary': { main: 'gemini', fallback: 'self-hosted' },
  'invoice-reader': { main: 'gpt', fallback: 'claude-haiku' },
  'onboarding-helper': { main: 'claude-haiku', fallback: 'gemini' },
};

/** Inserts the default rule for any feature that has none. Safe to run on every start. */
export async function seedRoutingRules(db: Db): Promise<void> {
  const rows = Object.entries(DEFAULT_RULES).map(([featureId, r]) => ({
    featureId,
    mainModelId: r.main,
    fallbackModelId: r.fallback,
  }));
  await db.insert(routingRules).values(rows).onConflictDoNothing();
}
