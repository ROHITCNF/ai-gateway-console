import {
  FeaturesResponse,
  HistoryResponse,
  ModelsResponse,
  RequestsResponse,
  RoutesResponse,
} from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { requests, routeChanges } from '../db/schema';
import { DEFAULT_RULES } from '../db/seed';
import { generateHistory, type RuleMap } from '../sim/engine';
import { createRng } from '../sim/rng';
import { useTestApp } from '../test-utils';

const rules = Object.fromEntries(
  Object.entries(DEFAULT_RULES).map(([f, r]) => [
    f,
    { mainModelId: r.main, fallbackModelId: r.fallback },
  ]),
) as RuleMap;

describe('read API (FR-29)', () => {
  const t = useTestApp();
  const get = async (path: string) => {
    const res = await t.as(await t.signIn('viewer'), `/api${path}`);
    return { status: res.status, body: await res.json() };
  };

  it('lists models with prices and features', async () => {
    expect(ModelsResponse.parse((await get('/models')).body).models).toHaveLength(7);
    expect(FeaturesResponse.parse((await get('/features')).body).features).toHaveLength(5);
  });

  it('lists one routing rule per feature', async () => {
    const { rules: list } = RoutesResponse.parse((await get('/routes')).body);
    expect(list).toHaveLength(5);
    expect(list.find((r) => r.featureId === 'support-bot')?.mainModelId).toBe('claude-opus');
  });

  it('lists history newest first', async () => {
    const base = {
      changedBy: 'Priya',
      featureId: 'support-bot',
      oldMainModelId: 'claude-opus',
      newMainModelId: 'claude-haiku',
      oldFallbackModelId: 'claude-sonnet',
      newFallbackModelId: 'claude-sonnet',
      source: 'click',
      estimatedCostChangePercent: -80,
    };
    await t.database.db.insert(routeChanges).values([
      { ...base, id: 'a', timestamp: new Date(1000) },
      { ...base, id: 'b', timestamp: new Date(2000) },
    ]);
    const { changes } = HistoryResponse.parse((await get('/history')).body);
    expect(changes.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('pages requests newest first, filtered by since (inclusive) and limit', async () => {
    const reqs = generateHistory(createRng(1), 300, 0, 300_000, rules);
    await t.database.db.insert(requests).values(reqs);
    const all = RequestsResponse.parse((await get('/requests?limit=1000')).body).requests;
    expect(all).toHaveLength(300);
    expect(all[0]?.timestamp).toBeGreaterThanOrEqual(all[1]?.timestamp ?? 0);

    const cut = reqs[200]?.timestamp ?? 0;
    const since = RequestsResponse.parse((await get(`/requests?since=${cut}`)).body).requests;
    expect(since.every((r) => r.timestamp >= cut)).toBe(true);
    expect(since).toHaveLength(reqs.filter((r) => r.timestamp >= cut).length);

    expect(RequestsResponse.parse((await get('/requests?limit=10')).body).requests).toHaveLength(
      10,
    );
    expect((await get('/requests?limit=abc')).status).toBe(400);
  });
});
