import { FEATURES, HistoryResponse, RoutesResponse } from '@gateway/contracts';
import { serializeSigned } from 'hono/utils/cookie';
import { describe, expect, it } from 'vitest';
import { TEST_SECRET, useTestApp } from '../test-utils';
import { SESSION_COOKIE } from './session';

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const toHaiku = { mainModelId: 'claude-haiku', fallbackModelId: 'claude-sonnet' };

/** End-to-end role checks through the real app, session and route change handler (NFR-6, NFR-14). */
describe('role checks end to end (NFR-6, FR-21, Flow F)', () => {
  const t = useTestApp();

  async function expectNothingChanged(cookie: string) {
    const routes = RoutesResponse.parse(await (await t.as(cookie, '/api/routes')).json());
    expect(
      Object.fromEntries(
        routes.rules.map((r) => [r.featureId, [r.mainModelId, r.fallbackModelId]]),
      ),
    ).toEqual({
      'support-bot': ['claude-opus', 'claude-sonnet'],
      'code-review': ['claude-sonnet', 'gpt'],
      'search-summary': ['gemini', 'self-hosted'],
      'invoice-reader': ['gpt', 'claude-haiku'],
      'onboarding-helper': ['claude-haiku', 'gemini'],
    });
    const hist = HistoryResponse.parse(await (await t.as(cookie, '/api/history')).json());
    expect(hist.changes).toHaveLength(0);
    expect(t.changed).toHaveLength(0);
  }

  it('rejects a viewer for every feature and every source (click, chat, undo)', async () => {
    const viewer = await t.signIn('viewer', 'Sam');
    for (const { id } of FEATURES) {
      for (const source of ['click', 'chat', 'undo']) {
        const res = await t.as(
          viewer,
          `/api/routes/${id}/changes`,
          post({ mainModelId: 'gpt', fallbackModelId: 'gemini', source }),
        );
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'Only Admins can change routes' });
      }
    }
    await expectNothingChanged(viewer);
  });

  it('checks the role before reading the body, so crafted bodies learn nothing', async () => {
    const viewer = await t.signIn('viewer');
    for (const body of [null, {}, { ...toHaiku, source: 'api' }, { ...toHaiku, role: 'admin' }]) {
      expect((await t.as(viewer, '/api/routes/support-bot/changes', post(body))).status).toBe(403);
    }
    expect((await t.as(viewer, '/api/routes/nope/changes', post(toHaiku))).status).toBe(403);
    await expectNothingChanged(viewer);
  });

  it('ignores extra role headers and fields a viewer adds', async () => {
    const viewer = await t.signIn('viewer');
    const res = await t.as(viewer, '/api/routes/support-bot/changes', {
      ...post({ ...toHaiku, source: 'click', role: 'admin', user: { role: 'admin' } }),
      headers: { 'x-role': 'admin', authorization: 'Bearer admin' },
    });
    expect(res.status).toBe(403);
    await expectNothingChanged(viewer);
  });

  it('takes the role from the session, not the cookie payload', async () => {
    // Even a validly signed cookie that claims "admin" stays a viewer: the session row decides.
    const viewer = await t.signIn('viewer', 'Sam');
    const value = decodeURIComponent(viewer.slice(viewer.indexOf('=') + 1));
    const payload = JSON.parse(value.slice(0, value.lastIndexOf('.'))) as { sid: string };
    const forged = (
      await serializeSigned(
        SESSION_COOKIE,
        JSON.stringify({ sid: payload.sid, name: 'Sam', role: 'admin' }),
        TEST_SECRET,
      )
    ).split(';')[0];
    const res = await t.as(forged ?? '', '/api/routes/support-bot/changes', post(toHaiku));
    expect(res.status).toBe(403);
    await expectNothingChanged(viewer);
  });

  it('rejects signed-out and signed-out-again admins with 401', async () => {
    expect(
      (
        await t.app.request('/api/routes/support-bot/changes', {
          ...post({ ...toHaiku, source: 'click' }),
          headers: { 'content-type': 'application/json' },
        })
      ).status,
    ).toBe(401);
    const admin = await t.signIn('admin');
    await t.as(admin, '/api/session', { method: 'DELETE' });
    const res = await t.as(
      admin,
      '/api/routes/support-bot/changes',
      post({ ...toHaiku, source: 'click' }),
    );
    expect(res.status).toBe(401);
    const viewer = await t.signIn('viewer');
    await expectNothingChanged(viewer);
  });

  it('lets an admin through the same path (control)', async () => {
    const admin = await t.signIn('admin');
    const res = await t.as(
      admin,
      '/api/routes/support-bot/changes',
      post({ ...toHaiku, source: 'click' }),
    );
    expect(res.status).toBe(200);
    expect(t.changed).toHaveLength(1);
  });
});
