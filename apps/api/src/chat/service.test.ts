import {
  CHAT_ACTION_KINDS,
  ChatResponse,
  type FeatureId,
  type Team,
  type User,
} from '@gateway/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Database, openDatabase } from '../db/client';
import { requests, routeChanges, routingRules } from '../db/schema';
import { seedRoutingRules } from '../db/seed';
import { ChatService, localMidnight } from './service';

// 2026-10-21 10:00 UTC.
const NOW = Date.UTC(2026, 9, 21, 10, 0, 0);
const admin = { name: 'Priya', role: 'admin' as const };
const viewer = { name: 'Sam', role: 'viewer' as const };

let database: Database;
let chat: ChatService;

beforeEach(async () => {
  database = await openDatabase();
  await seedRoutingRules(database.db);
  chat = new ChatService({ db: database.db, now: () => NOW });
});
afterEach(() => database.close());

let n = 0;
async function addRequest(r: {
  featureId: FeatureId;
  team: Team;
  ago: number;
  cost: number;
  status?: 'success' | 'failed' | 'fallback';
  model?: 'claude-opus' | 'claude-haiku' | 'gpt';
}) {
  n += 1;
  await database.db.insert(requests).values({
    id: `req_${n}`,
    timestamp: NOW - r.ago,
    featureId: r.featureId,
    team: r.team,
    plannedModelId: r.model ?? 'claude-opus',
    servedModelId: r.status === 'failed' ? null : (r.model ?? 'claude-opus'),
    status: r.status ?? 'success',
    latencyMs: 500,
    inputTokens: 1000,
    outputTokens: 500,
    cost: r.cost,
    errorReason: r.status === 'failed' ? 'timeout' : null,
  });
}

async function ask(text: string, user: User = admin, timezoneOffsetMinutes = 0) {
  // Every reply must fit the shared contract and the fixed action list (NFR-7).
  const res = ChatResponse.parse(await chat.respond(user, { text, timezoneOffsetMinutes }));
  expect(CHAT_ACTION_KINDS).toContain(res.action.kind);
  expect(res.understood.length).toBeGreaterThan(0);
  return res;
}

describe('chat: filters (FR-25, FR-28)', () => {
  it('returns a filter action and says what it understood', async () => {
    const res = await ask('show failed requests from support-bot today');
    expect(res.understood).toBe('Filter: feature = support-bot, status = failed, time = today');
    expect(res.action).toEqual({
      kind: 'filter',
      filters: {
        featureId: 'support-bot',
        team: null,
        modelId: null,
        status: 'failed',
        timeRange: 'today',
        requestId: '',
      },
    });
  });

  it('defaults the time to all data (Flow E with team)', async () => {
    const res = await ask('failed requests from the payments team');
    expect(res.understood).toBe('Filter: team = Payments, status = failed, time = all data');
  });
});

describe('chat: cost questions from stored data (FR-25, NFR-7)', () => {
  beforeEach(async () => {
    await addRequest({
      featureId: 'support-bot',
      team: 'Customer Support',
      ago: 60_000,
      cost: 1.5,
    });
    await addRequest({
      featureId: 'support-bot',
      team: 'Customer Support',
      ago: 2 * 3600_000,
      cost: 2,
    });
    // Yesterday in UTC.
    await addRequest({
      featureId: 'support-bot',
      team: 'Customer Support',
      ago: 11 * 3600_000,
      cost: 4,
    });
    await addRequest({
      featureId: 'invoice-reader',
      team: 'Payments',
      ago: 60_000,
      cost: 0.25,
      model: 'gpt',
    });
    await addRequest({
      featureId: 'invoice-reader',
      team: 'Payments',
      ago: 120_000,
      cost: 0,
      status: 'failed',
      model: 'gpt',
    });
  });

  it('sums cost for a feature today', async () => {
    const res = await ask('how much did support-bot cost today');
    expect(res.understood).toBe('Cost question: feature = support-bot, time = today');
    expect(res.reply).toBe('support-bot cost $3.50 across 2 requests (today).');
    expect(res.action).toEqual({ kind: 'answer' });
  });

  it('uses the user time zone for "today" (D13.5)', async () => {
    // UTC-12: local midnight is 12:00 UTC the day before, so all three support-bot rows count.
    const res = await ask('how much did support-bot cost today', admin, -12 * 60);
    expect(res.reply).toBe('support-bot cost $7.50 across 3 requests (today).');
  });

  it('answers by team, time and status', async () => {
    expect((await ask('what did the payments team spend in the last hour')).reply).toBe(
      'Payments cost $0.25 across 2 requests (last hour).',
    );
    expect((await ask('total spend')).reply).toBe(
      'All features cost $7.75 across 5 requests (all data).',
    );
    expect((await ask('cost of failed requests')).reply).toBe(
      'All features cost $0.00 across 1 request (all data).',
    );
  });

  it('says so when nothing matches, rather than inventing a number', async () => {
    const res = await ask('how much did onboarding-helper cost in the last 5 minutes');
    expect(res.reply).toBe(
      'No requests match that (last 5 minutes), so there is no spend to report.',
    );
  });
});

describe('chat: route proposals (FR-25, FR-26, D13.11, D14.4, NFR-5)', () => {
  it('proposes the cheapest model for the feature and keeps the backup', async () => {
    const res = await ask('move support-bot to a cheaper model');
    expect(res.action).toEqual({
      kind: 'propose_route_change',
      featureId: 'support-bot',
      mainModelId: 'self-hosted',
      fallbackModelId: 'claude-sonnet',
    });
    expect(res.understood).toBe(
      'Route change: support-bot main Claude Opus → Llama (self-hosted) (cheapest for this feature), backup stays Claude Sonnet',
    );
  });

  it('skips the backup when picking the cheapest', async () => {
    // search-summary: Gemini with self-hosted backup; next cheapest is Claude Haiku.
    const res = await ask('switch search summary to something cheaper');
    expect(res.action).toMatchObject({
      mainModelId: 'claude-haiku',
      fallbackModelId: 'self-hosted',
    });
  });

  it('makes no proposal when nothing is cheaper', async () => {
    await database.db
      .update(routingRules)
      .set({ mainModelId: 'self-hosted', fallbackModelId: 'gemini' })
      .where(eq(routingRules.featureId, 'onboarding-helper'));
    const res = await ask('move onboarding-helper to a cheaper model');
    expect(res.action).toEqual({ kind: 'answer' });
    expect(res.reply).toContain('No other model is cheaper than Llama (self-hosted)');
  });

  it('proposes a named model', async () => {
    const res = await ask('move support-bot to Grok');
    expect(res.action).toEqual({
      kind: 'propose_route_change',
      featureId: 'support-bot',
      mainModelId: 'grok',
      fallbackModelId: 'claude-sonnet',
    });
  });

  it('explains instead of proposing the current main or the backup', async () => {
    expect((await ask('move support-bot to opus')).action).toEqual({ kind: 'answer' });
    const res = await ask('move support-bot to sonnet');
    expect(res.action).toEqual({ kind: 'answer' });
    expect(res.reply).toContain('already the backup');
  });

  it('asks which feature when none is named', async () => {
    const res = await ask('move to a cheaper model');
    expect(res.action).toEqual({ kind: 'not_understood' });
    expect(res.reply).toContain('Which feature');
  });

  it('never applies anything: rules and history stay the same', async () => {
    await ask('move support-bot to a cheaper model');
    await ask('move support-bot to Grok');
    const [rule] = await database.db
      .select()
      .from(routingRules)
      .where(eq(routingRules.featureId, 'support-bot'));
    expect(rule?.mainModelId).toBe('claude-opus');
    expect(await database.db.select().from(routeChanges)).toHaveLength(0);
  });
});

describe('chat: Viewer refusal (FR-27, Flow F)', () => {
  it('refuses a change politely and shows the current route', async () => {
    const res = await ask('move support-bot to Grok', viewer);
    expect(res.action).toEqual({ kind: 'refuse' });
    expect(res.understood).toBe('Route change: support-bot → Grok (Admins only)');
    expect(res.reply).toBe(
      'Sorry, only Admins can change routes. support-bot uses Claude Opus, with Claude Sonnet as backup.',
    );
  });

  it('refuses "cheaper" too, and still lets Viewers filter and ask', async () => {
    expect((await ask('move support-bot to a cheaper model', viewer)).action.kind).toBe('refuse');
    expect((await ask('show failed requests', viewer)).action.kind).toBe('filter');
    expect((await ask('total spend', viewer)).action.kind).toBe('answer');
  });
});

describe('chat: show route and not understood (FR-27)', () => {
  it('shows the current route', async () => {
    const res = await ask('what model does code-review use');
    expect(res.action).toEqual({ kind: 'show_route', featureId: 'code-review' });
    expect(res.reply).toBe('code-review uses Claude Sonnet, with GPT as backup.');
  });

  it('says so and suggests what it can do', async () => {
    const res = await ask('tell me a joke');
    expect(res.understood).toBe('Not understood');
    expect(res.action).toEqual({ kind: 'not_understood' });
    expect(res.reply).toContain('move support-bot to a cheaper model');
    // Viewers are not offered a change they cannot make.
    expect((await ask('tell me a joke', viewer)).reply).not.toContain('move');
  });
});

describe('localMidnight (D13.5)', () => {
  it('is the start of the local day', () => {
    expect(localMidnight(NOW, 0)).toBe(Date.UTC(2026, 9, 21));
    // UTC+5:30 → 15:30 local, midnight local = 18:30 UTC the day before.
    expect(localMidnight(NOW, 330)).toBe(Date.UTC(2026, 9, 20, 18, 30));
    // UTC-12 → 22:00 local the day before.
    expect(localMidnight(NOW, -720)).toBe(Date.UTC(2026, 9, 20, 12));
  });
});
