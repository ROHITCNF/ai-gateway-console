import { HistoryResponse, RouteChangeResponse, RoutesResponse } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { requests } from '../db/schema';
import { useTestApp } from '../test-utils';

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const toHaiku = { mainModelId: 'claude-haiku', fallbackModelId: 'claude-sonnet', source: 'click' };

describe('route change API (FR-17..FR-20, FR-22, FR-32, NFR-6)', () => {
  const t = useTestApp();

  it('applies a change, records history with source and estimate, notifies', async () => {
    await t.database.db.insert(requests).values(
      Array.from({ length: 60 }, (_, i) => ({
        id: `r${i}`,
        timestamp: Date.now() - 1000,
        featureId: 'support-bot',
        team: 'Customer Support',
        plannedModelId: 'claude-opus',
        servedModelId: 'claude-opus',
        status: 'success',
        latencyMs: 1000,
        inputTokens: 1000,
        outputTokens: 1000,
        cost: 0.09,
        errorReason: null,
      })),
    );
    const admin = await t.signIn('admin', 'Priya');
    const est = await (
      await t.as(admin, '/api/routes/estimate', post({ featureId: 'support-bot', ...toHaiku }))
    ).json();
    expect(est).toEqual({ percent: -95, basis: 'last_hour', sampleSize: 60 });

    const started = Date.now();
    const res = await t.as(admin, '/api/routes/support-bot/changes', post(toHaiku));
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
    const { rule, change } = RouteChangeResponse.parse(await res.json());
    expect(rule.mainModelId).toBe('claude-haiku');
    expect(change).toMatchObject({
      changedBy: 'Priya',
      featureId: 'support-bot',
      oldMainModelId: 'claude-opus',
      newMainModelId: 'claude-haiku',
      oldFallbackModelId: 'claude-sonnet',
      newFallbackModelId: 'claude-sonnet',
      source: 'click',
      estimatedCostChangePercent: -95,
    });
    expect(t.changed).toHaveLength(1);

    const routes = RoutesResponse.parse(await (await t.as(admin, '/api/routes')).json());
    expect(routes.rules.find((r) => r.featureId === 'support-bot')?.mainModelId).toBe(
      'claude-haiku',
    );
    const hist = HistoryResponse.parse(await (await t.as(admin, '/api/history')).json());
    expect(hist.changes).toHaveLength(1);
  });

  it('blocks viewers in the backend, even with a crafted request (NFR-6)', async () => {
    const viewer = await t.signIn('viewer');
    const res = await t.as(viewer, '/api/routes/support-bot/changes', post(toHaiku));
    expect(res.status).toBe(403);
    const routes = RoutesResponse.parse(await (await t.as(viewer, '/api/routes')).json());
    expect(routes.rules.find((r) => r.featureId === 'support-bot')?.mainModelId).toBe(
      'claude-opus',
    );
  });

  it('validates the change (routing rules)', async () => {
    const admin = await t.signIn('admin');
    const same = { mainModelId: 'gpt', fallbackModelId: 'gpt', source: 'click' };
    expect((await t.as(admin, '/api/routes/support-bot/changes', post(same))).status).toBe(400);
    const current = {
      mainModelId: 'claude-opus',
      fallbackModelId: 'claude-sonnet',
      source: 'click',
    };
    expect((await t.as(admin, '/api/routes/support-bot/changes', post(current))).status).toBe(409);
    expect((await t.as(admin, '/api/routes/nope/changes', post(toHaiku))).status).toBe(400);
    expect(
      (await t.as(admin, '/api/routes/support-bot/changes', post({ ...toHaiku, source: 'api' })))
        .status,
    ).toBe(400);
  });

  it('keeps the old route when the gateway fails the change (FR-32)', async () => {
    t.failNext = true;
    const admin = await t.signIn('admin');
    const res = await t.as(admin, '/api/routes/support-bot/changes', post(toHaiku));
    expect(res.status).toBe(503);
    const routes = RoutesResponse.parse(await (await t.as(admin, '/api/routes')).json());
    expect(routes.rules.find((r) => r.featureId === 'support-bot')?.mainModelId).toBe(
      'claude-opus',
    );
    const hist = HistoryResponse.parse(await (await t.as(admin, '/api/history')).json());
    expect(hist.changes).toHaveLength(0);
  });
});
