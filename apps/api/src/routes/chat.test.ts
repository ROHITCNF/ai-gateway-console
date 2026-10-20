import { ChatResponse, HistoryResponse, RoutesResponse } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { useTestApp } from '../test-utils';

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

describe('POST /api/chat (FR-24..FR-28, NFR-5, NFR-7)', () => {
  const t = useTestApp();

  it('returns what it understood and an allowed action', async () => {
    const admin = await t.signIn('admin');
    const res = await t.as(
      admin,
      '/api/chat',
      post({ text: 'show failed requests from support-bot today' }),
    );
    expect(res.status).toBe(200);
    const body = ChatResponse.parse(await res.json());
    expect(body.understood).toBe('Filter: feature = support-bot, status = failed, time = today');
    expect(body.action.kind).toBe('filter');
  });

  it('proposes a change but never applies it (FR-26, NFR-5)', async () => {
    const admin = await t.signIn('admin');
    const body = ChatResponse.parse(
      await (
        await t.as(admin, '/api/chat', post({ text: 'move support-bot to a cheaper model' }))
      ).json(),
    );
    expect(body.action).toMatchObject({ kind: 'propose_route_change', featureId: 'support-bot' });
    const routes = RoutesResponse.parse(await (await t.as(admin, '/api/routes')).json());
    expect(routes.rules.find((r) => r.featureId === 'support-bot')?.mainModelId).toBe(
      'claude-opus',
    );
    const hist = HistoryResponse.parse(await (await t.as(admin, '/api/history')).json());
    expect(hist.changes).toHaveLength(0);
    expect(t.changed).toHaveLength(0);
  });

  it('refuses a Viewer change from the session role, not the request (FR-27, NFR-6)', async () => {
    const viewer = await t.signIn('viewer');
    const res = await t.as(
      viewer,
      '/api/chat',
      post({ text: 'move support-bot to Grok', role: 'admin' }),
    );
    expect(ChatResponse.parse(await res.json()).action).toEqual({ kind: 'refuse' });
  });

  it('passes the time zone through for "today"', async () => {
    const admin = await t.signIn('admin');
    const res = await t.as(
      admin,
      '/api/chat',
      post({ text: 'how much did support-bot cost today', timezoneOffsetMinutes: 330 }),
    );
    expect(ChatResponse.parse(await res.json()).action).toEqual({ kind: 'answer' });
  });

  it('validates input and requires sign-in', async () => {
    const admin = await t.signIn('admin');
    for (const body of [
      null,
      {},
      { text: '   ' },
      { text: 'x'.repeat(501) },
      { text: 'hi', timezoneOffsetMinutes: 9999 },
    ]) {
      expect((await t.as(admin, '/api/chat', post(body))).status).toBe(400);
    }
    const res = await t.app.request('/api/chat', {
      ...post({ text: 'total spend' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });
});
