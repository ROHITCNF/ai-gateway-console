import { randomUUID } from 'node:crypto';
import type {
  ChangeSource,
  EstimateResponse,
  FeatureId,
  ModelId,
  RouteChangeResponse,
  User,
} from '@gateway/contracts';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { toChange, toRule } from '../db/mappers';
import { requests, routeChanges, routingRules } from '../db/schema';
import { estimateCostChange } from './estimate';

export class RouteChangeError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 503,
  ) {
    super(message);
  }
}

export interface RoutingOptions {
  db: Db;
  now?: () => number;
  /** Delay before the gateway confirms (D13.9). */
  confirmDelayMs?: number;
  /** Return true to fail this change (developer control, D13.9). */
  shouldFail?: () => boolean;
  /** Called after a confirmed change; e.g. updates the simulator and the stream. */
  onChanged?: (result: RouteChangeResponse) => void;
}

/** Applies route changes (FR-17..FR-20, FR-22, FR-32, D15.9). Role is checked by the caller's route. */
export class RoutingService {
  readonly #o: Required<Omit<RoutingOptions, 'onChanged'>> & Pick<RoutingOptions, 'onChanged'>;

  constructor(opts: RoutingOptions) {
    this.#o = { now: Date.now, confirmDelayMs: 300, shouldFail: () => false, ...opts };
  }

  async #rule(featureId: FeatureId) {
    const [rule] = await this.#o.db
      .select()
      .from(routingRules)
      .where(eq(routingRules.featureId, featureId));
    if (!rule) throw new RouteChangeError(`Unknown feature ${featureId}`, 404);
    return rule;
  }

  async estimate(featureId: FeatureId, mainModelId: ModelId): Promise<EstimateResponse> {
    const rule = await this.#rule(featureId);
    const samples = await this.#o.db
      .select({
        timestamp: requests.timestamp,
        inputTokens: requests.inputTokens,
        outputTokens: requests.outputTokens,
      })
      .from(requests)
      .where(eq(requests.featureId, featureId));
    return estimateCostChange(samples, rule.mainModelId as ModelId, mainModelId, this.#o.now());
  }

  async change(
    user: User,
    featureId: FeatureId,
    target: { mainModelId: ModelId; fallbackModelId: ModelId; source: ChangeSource },
  ): Promise<RouteChangeResponse> {
    if (target.mainModelId === target.fallbackModelId) {
      throw new RouteChangeError('Main and backup model must be different', 400);
    }
    const old = await this.#rule(featureId);
    if (old.mainModelId === target.mainModelId && old.fallbackModelId === target.fallbackModelId) {
      throw new RouteChangeError('This is already the current route', 409);
    }
    const est = await this.estimate(featureId, target.mainModelId);
    await new Promise((r) => setTimeout(r, this.#o.confirmDelayMs));
    if (this.#o.shouldFail())
      throw new RouteChangeError('The gateway rejected the change. Try again.', 503);

    const at = new Date(this.#o.now());
    const result = await this.#o.db.transaction(async (tx) => {
      const [rule] = await tx
        .update(routingRules)
        .set({
          mainModelId: target.mainModelId,
          fallbackModelId: target.fallbackModelId,
          updatedAt: at,
        })
        .where(eq(routingRules.featureId, featureId))
        .returning();
      const [change] = await tx
        .insert(routeChanges)
        .values({
          id: `chg_${randomUUID()}`,
          timestamp: at,
          changedBy: user.name,
          featureId,
          oldMainModelId: old.mainModelId,
          newMainModelId: target.mainModelId,
          oldFallbackModelId: old.fallbackModelId,
          newFallbackModelId: target.fallbackModelId,
          source: target.source,
          estimatedCostChangePercent: est.percent,
        })
        .returning();
      if (!rule || !change) throw new Error('Route change write failed');
      return { rule: toRule(rule), change: toChange(change) };
    });
    this.#o.onChanged?.(result);
    return result;
  }
}
