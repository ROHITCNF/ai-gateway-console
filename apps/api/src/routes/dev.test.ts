import { DevState, RoutesResponse } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { useTestApp } from '../test-utils';

describe('developer controls API (D13.8, D13.9, D13.14)', () => {
  const t = useTestApp();
  const patch = (body: unknown) => ({ method: 'PATCH', body: JSON.stringify(body) });

  it('reads and sets the global request rate, for any role', async () => {
    const viewer = await t.signIn('viewer');
    expect(DevState.parse(await (await t.as(viewer, '/api/dev')).json())).toEqual({
      rate: 1,
      failNextRouteChange: false,
    });
    const res = await t.as(viewer, '/api/dev', patch({ rate: 20 }));
    expect(DevState.parse(await res.json()).rate).toBe(20);
    expect((await t.as(viewer, '/api/dev', patch({ rate: 7 }))).status).toBe(400);
  });

  it('fails only the next route change (D13.9)', async () => {
    const admin = await t.signIn('admin');
    await t.as(admin, '/api/dev', patch({ failNextRouteChange: true }));
    const change = {
      method: 'POST',
      body: JSON.stringify({
        mainModelId: 'claude-haiku',
        fallbackModelId: 'claude-sonnet',
        source: 'click',
      }),
    };
    expect((await t.as(admin, '/api/routes/support-bot/changes', change)).status).toBe(503);
    expect(t.dev.state.failNextRouteChange).toBe(false);
    const routes = RoutesResponse.parse(await (await t.as(admin, '/api/routes')).json());
    expect(routes.rules.find((r) => r.featureId === 'support-bot')?.mainModelId).toBe(
      'claude-opus',
    );
    expect((await t.as(admin, '/api/routes/support-bot/changes', change)).status).toBe(200);
  });

  it('drops one connection and refuses its reconnects for the chosen time (D15.12)', async () => {
    const viewer = await t.signIn('viewer');
    let closed = 0;
    t.hub.add('me', { send: () => {}, close: () => closed++ });
    t.hub.add('other', { send: () => {}, close: () => closed++ });
    const res = await t.as(viewer, '/api/dev/drop', {
      method: 'POST',
      body: JSON.stringify({ connectionId: 'me', seconds: 5 }),
    });
    expect(res.status).toBe(200);
    expect(closed).toBe(1);
    expect(t.hub.size).toBe(1);
    expect((await t.as(viewer, '/api/stream?clientId=me')).status).toBe(503);
    expect(t.hub.isBlocked('me', Date.now() + 6000)).toBe(false);
  });
});
