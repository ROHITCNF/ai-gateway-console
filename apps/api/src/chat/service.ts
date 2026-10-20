import {
  type ChatBody,
  type ChatResponse,
  cost,
  type FeatureId,
  getModel,
  MODELS,
  type ModelId,
  type RequestFilters,
  type RoutingRule,
  type TimeRange,
  type User,
} from '@gateway/contracts';
import { and, count, eq, gte, type SQL, sum } from 'drizzle-orm';
import type { Db } from '../db/client';
import { toRule } from '../db/mappers';
import { requests, routingRules } from '../db/schema';
import { ESTIMATE_MIN_SAMPLE, ESTIMATE_WINDOW_MS } from '../routing/estimate';
import { type Intent, type ParsedFilters, parseIntent } from './parser';

/**
 * Turns chat text into a reply and one action from the fixed list (D6, D15.10, NFR-7). It reads
 * stored data only and never applies a change: a route change is only proposed (FR-26, NFR-5).
 */

const TIME_LABEL: Record<TimeRange, string> = {
  '5m': 'last 5 minutes',
  '1h': 'last hour',
  today: 'today',
  all: 'all data',
};

const EXAMPLES_ALL = [
  '"show failed requests from support-bot today"',
  '"how much did the payments team spend in the last hour"',
  '"what model does support-bot use"',
];
const EXAMPLE_MOVE = '"move support-bot to a cheaper model"';

const name = (id: ModelId) => getModel(id).displayName;
const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Start of "today" in the user's time zone (D13.5). `offset` = minutes east of UTC. */
export function localMidnight(now: number, offsetMinutes: number): number {
  const shift = offsetMinutes * 60_000;
  const day = 86_400_000;
  return Math.floor((now + shift) / day) * day - shift;
}

export function rangeStart(range: TimeRange, now: number, offsetMinutes: number): number | null {
  switch (range) {
    case '5m':
      return now - 5 * 60_000;
    case '1h':
      return now - 3600_000;
    case 'today':
      return localMidnight(now, offsetMinutes);
    case 'all':
      return null;
  }
}

/** "feature = support-bot, status = failed, time = today" (FR-28). */
export function describeFilters(f: ParsedFilters): string {
  const parts: string[] = [];
  if (f.featureId) parts.push(`feature = ${f.featureId}`);
  if (f.team) parts.push(`team = ${f.team}`);
  if (f.modelId) parts.push(`model = ${name(f.modelId)}`);
  if (f.status) parts.push(`status = ${f.status}`);
  parts.push(`time = ${TIME_LABEL[f.timeRange ?? 'all']}`);
  return parts.join(', ');
}

export interface ChatServiceOptions {
  db: Db;
  now?: () => number;
}

export class ChatService {
  readonly #db: Db;
  readonly #now: () => number;

  constructor(opts: ChatServiceOptions) {
    this.#db = opts.db;
    this.#now = opts.now ?? Date.now;
  }

  async respond(
    user: User,
    body: Pick<ChatBody, 'text'> & Partial<ChatBody>,
  ): Promise<ChatResponse> {
    const intent = parseIntent(body.text);
    const offset = body.timezoneOffsetMinutes ?? 0;
    switch (intent.kind) {
      case 'filter':
        return this.#filter(intent.filters);
      case 'cost':
        return this.#cost(intent.filters, offset);
      case 'show_route':
        return this.#showRoute(intent.featureId);
      case 'move':
        return this.#move(user, intent);
      case 'unknown':
        return notUnderstood(user);
    }
  }

  #filter(f: ParsedFilters): ChatResponse {
    const filters: RequestFilters = {
      featureId: f.featureId,
      team: f.team,
      modelId: f.modelId,
      status: f.status,
      timeRange: f.timeRange ?? 'all',
      requestId: '',
    };
    const understood = `Filter: ${describeFilters(f)}`;
    return {
      understood,
      reply: 'Done. Live Requests now shows only the matching requests.',
      action: { kind: 'filter', filters },
    };
  }

  /** Spend from stored requests (NFR-7). Model = the served model, which is what was paid for. */
  async #cost(f: ParsedFilters, offset: number): Promise<ChatResponse> {
    const where: SQL[] = [];
    if (f.featureId) where.push(eq(requests.featureId, f.featureId));
    if (f.team) where.push(eq(requests.team, f.team));
    if (f.modelId) where.push(eq(requests.servedModelId, f.modelId));
    if (f.status) where.push(eq(requests.status, f.status));
    const start = rangeStart(f.timeRange ?? 'all', this.#now(), offset);
    if (start !== null) where.push(gte(requests.timestamp, start));
    const [row] = await this.#db
      .select({ total: sum(requests.cost), n: count() })
      .from(requests)
      .where(and(...where));
    const total = Number(row?.total ?? 0);
    const n = Number(row?.n ?? 0);
    const scope = f.featureId ?? f.team ?? (f.modelId ? name(f.modelId) : 'All features');
    const when = TIME_LABEL[f.timeRange ?? 'all'];
    const reply =
      n === 0
        ? `No requests match that (${when}), so there is no spend to report.`
        : `${scope} cost ${usd(total)} across ${n.toLocaleString('en-US')} ${n === 1 ? 'request' : 'requests'} (${when}).`;
    return {
      understood: `Cost question: ${describeFilters(f)}`,
      reply,
      action: { kind: 'answer' },
    };
  }

  async #rule(featureId: FeatureId): Promise<RoutingRule | null> {
    const [row] = await this.#db
      .select()
      .from(routingRules)
      .where(eq(routingRules.featureId, featureId));
    return row ? toRule(row) : null;
  }

  async #showRoute(featureId: FeatureId): Promise<ChatResponse> {
    const rule = await this.#rule(featureId);
    if (!rule) return notUnderstood(null);
    return {
      understood: `Show route: ${featureId}`,
      reply: routeText(rule),
      action: { kind: 'show_route', featureId },
    };
  }

  async #move(user: User, intent: Extract<Intent, { kind: 'move' }>): Promise<ChatResponse> {
    const targetLabel = intent.target === 'cheaper' ? 'a cheaper model' : name(intent.target);
    if (!intent.featureId) {
      return {
        understood: `Route change: unknown feature → ${targetLabel}`,
        reply: `Which feature should move? For example ${EXAMPLE_MOVE}.`,
        action: { kind: 'not_understood' },
      };
    }
    const featureId = intent.featureId;
    const rule = await this.#rule(featureId);
    if (!rule) return notUnderstood(user);

    // Viewers are refused before anything is computed (FR-27, Flow F). The API checks again (NFR-6).
    if (user.role !== 'admin') {
      return {
        understood: `Route change: ${featureId} → ${targetLabel} (Admins only)`,
        reply: `Sorry, only Admins can change routes. ${routeText(rule)}`,
        action: { kind: 'refuse' },
      };
    }

    const target =
      intent.target === 'cheaper' ? await this.#cheapest(featureId, rule) : intent.target;
    if (target === null) {
      return {
        understood: `Route change: ${featureId} → a cheaper model`,
        reply: `No other model is cheaper than ${name(rule.mainModelId)} for ${featureId}'s traffic (the backup, ${name(rule.fallbackModelId)}, cannot also be the main). No change to suggest.`,
        action: { kind: 'answer' },
      };
    }
    if (target === rule.mainModelId) {
      return {
        understood: `Route change: ${featureId} → ${name(target)}`,
        reply: `${featureId} already uses ${name(target)}. No change to suggest.`,
        action: { kind: 'answer' },
      };
    }
    if (target === rule.fallbackModelId) {
      return {
        understood: `Route change: ${featureId} → ${name(target)}`,
        reply: `${name(target)} is already the backup for ${featureId}, and main and backup must differ. Pick another model, or change the backup on Routing first.`,
        action: { kind: 'answer' },
      };
    }
    const why = intent.target === 'cheaper' ? ' (cheapest for this feature)' : '';
    return {
      understood: `Route change: ${featureId} main ${name(rule.mainModelId)} → ${name(target)}${why}, backup stays ${name(rule.fallbackModelId)}`,
      reply: 'Review the change and click Confirm to apply it. Nothing changes until you do.',
      // Backup stays as it is (D14.4).
      action: {
        kind: 'propose_route_change',
        featureId,
        mainModelId: target,
        fallbackModelId: rule.fallbackModelId,
      },
    };
  }

  /**
   * "Cheaper model" (D13.11, D14.4): the model with the lowest estimated cost on the feature's
   * stored tokens (same sample as the estimate, D13.10), excluding the current main. The backup is
   * also excluded, since main and backup must differ. Null when nothing is cheaper than the main.
   */
  async #cheapest(featureId: FeatureId, rule: RoutingRule): Promise<ModelId | null> {
    const all = await this.#db
      .select({
        timestamp: requests.timestamp,
        inputTokens: requests.inputTokens,
        outputTokens: requests.outputTokens,
      })
      .from(requests)
      .where(eq(requests.featureId, featureId));
    const recent = all.filter((s) => s.timestamp >= this.#now() - ESTIMATE_WINDOW_MS);
    const used = recent.length >= ESTIMATE_MIN_SAMPLE ? recent : all;
    // No traffic yet: compare list prices on an even input/output mix.
    const sample = used.length > 0 ? used : [{ inputTokens: 1_000_000, outputTokens: 1_000_000 }];
    const total = (m: ModelId) =>
      sample.reduce((acc, s) => acc + cost(m, s.inputTokens, s.outputTokens), 0);

    const current = total(rule.mainModelId);
    let best: { id: ModelId; total: number } | null = null;
    for (const m of MODELS) {
      if (m.id === rule.mainModelId || m.id === rule.fallbackModelId) continue;
      const t = total(m.id);
      if (t < current && (!best || t < best.total)) best = { id: m.id, total: t };
    }
    return best?.id ?? null;
  }
}

function routeText(rule: RoutingRule): string {
  return `${rule.featureId} uses ${name(rule.mainModelId)}, with ${name(rule.fallbackModelId)} as backup.`;
}

function notUnderstood(user: User | null): ChatResponse {
  const examples = user?.role === 'admin' ? [...EXAMPLES_ALL, EXAMPLE_MOVE] : EXAMPLES_ALL;
  return {
    understood: 'Not understood',
    reply: `Sorry, I did not understand that. I can filter requests, answer cost questions and show routes. Try ${examples.join(', ')}.`,
    action: { kind: 'not_understood' },
  };
}
