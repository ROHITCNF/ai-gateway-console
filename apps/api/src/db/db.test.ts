import { FEATURES } from '@gateway/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, openDatabase } from './client';
import { requests, routingRules } from './schema';
import { DEFAULT_RULES, seedRoutingRules } from './seed';

describe('database (PGlite, D16.3)', () => {
  let database: Database;
  beforeAll(async () => {
    database = await openDatabase();
  });
  afterAll(() => database.close());

  it('seeds one default rule per feature, idempotently', async () => {
    await seedRoutingRules(database.db);
    await seedRoutingRules(database.db);
    const rules = await database.db.select().from(routingRules);
    expect(rules).toHaveLength(FEATURES.length);
    const support = rules.find((r) => r.featureId === 'support-bot');
    expect(support?.mainModelId).toBe(DEFAULT_RULES['support-bot'].main);
  });

  it('stores requests with epoch-ms timestamps', async () => {
    const ts = Date.UTC(2026, 9, 20, 12);
    await database.db.insert(requests).values({
      id: 'r1',
      timestamp: ts,
      featureId: 'support-bot',
      team: 'Customer Support',
      plannedModelId: 'claude-opus',
      servedModelId: null,
      status: 'failed',
      latencyMs: 30000,
      inputTokens: 100,
      outputTokens: 0,
      cost: 0,
      errorReason: 'timeout',
    });
    const [row] = await database.db.select().from(requests);
    expect(row?.timestamp).toBe(ts);
    expect(row?.servedModelId).toBeNull();
  });
});
