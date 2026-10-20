import { count } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Database, openDatabase } from '../db/client';
import { requests } from '../db/schema';
import { seedRoutingRules } from '../db/seed';
import { SEED_COUNT, SEED_WINDOW_MS, Simulator } from './runner';

describe('Simulator runner', () => {
  let database: Database;
  let now: number;
  const clock = () => now;
  const rows = async () => (await database.db.select({ n: count() }).from(requests))[0]?.n ?? 0;

  beforeEach(async () => {
    database = await openDatabase();
    await seedRoutingRules(database.db);
    now = Date.UTC(2026, 9, 20, 12);
  });
  afterEach(() => database.close());

  it('seeds 10k requests over the last 3 hours when empty, once (D13.4)', async () => {
    const sim = new Simulator({ db: database.db, seed: 1, now: clock });
    await sim.init();
    expect(await rows()).toBe(SEED_COUNT);
    const all = await database.db.select({ ts: requests.timestamp }).from(requests);
    expect(Math.min(...all.map((r) => r.ts))).toBeGreaterThanOrEqual(now - SEED_WINDOW_MS);
    await new Simulator({ db: database.db, seed: 1, now: clock }).init();
    expect(await rows()).toBe(SEED_COUNT);
  });

  it('generates rate × seconds requests per tick and notifies listeners', async () => {
    const sim = new Simulator({ db: database.db, seed: 2, now: clock, rate: 20 });
    await sim.init();
    const seen: number[] = [];
    sim.onBatch((b) => seen.push(b.length));
    now += 1000;
    expect(await sim.tick()).toHaveLength(20);
    sim.setRate(1);
    let total = 0;
    for (let i = 0; i < 8; i++) {
      now += 250;
      total += (await sim.tick()).length;
    }
    expect(total).toBe(2);
    expect(seen.reduce((a, b) => a + b, 0)).toBe(22);
    expect(await rows()).toBe(SEED_COUNT + 22);
  });

  it('uses a new rule from the next request (FR-20)', async () => {
    const sim = new Simulator({ db: database.db, seed: 3, now: clock, rate: 20 });
    await sim.init();
    for (const f of [
      'support-bot',
      'code-review',
      'search-summary',
      'invoice-reader',
      'onboarding-helper',
    ] as const)
      sim.setRule(f, 'claude-haiku', 'gemini');
    now += 1000;
    const batch = await sim.tick();
    expect(batch.every((r) => r.plannedModelId === 'claude-haiku')).toBe(true);
  });

  it('trims to the newest maxRows (D15.4)', async () => {
    const sim = new Simulator({ db: database.db, seed: 4, now: clock, maxRows: 500 });
    await sim.init();
    await sim.trim();
    expect(await rows()).toBeLessThanOrEqual(500);
    expect(await rows()).toBeGreaterThan(490);
  });
});
