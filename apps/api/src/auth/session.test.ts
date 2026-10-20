import { SessionResponse } from '@gateway/contracts';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { useTestApp } from '../test-utils';
import { type AuthEnv, requireRole } from './session';

describe('session (D4, D15.7)', () => {
  const t = useTestApp();

  it('signs in with an httpOnly signed cookie and reports the user', async () => {
    const res = await t.app.request('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Priya Rao', role: 'admin' }),
    });
    expect(res.status).toBe(200);
    const set = res.headers.get('set-cookie') ?? '';
    expect(set).toContain('HttpOnly');
    const cookie = set.split(';')[0] ?? '';
    const me = SessionResponse.parse(await (await t.as(cookie, '/api/session')).json());
    expect(me.user).toEqual({ name: 'Priya Rao', role: 'admin' });
  });

  it('rejects missing name or unknown role', async () => {
    for (const body of [{ name: '', role: 'admin' }, { name: 'X', role: 'owner' }, null]) {
      const res = await t.app.request('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(400);
    }
  });

  it('ignores a tampered cookie (role cannot be self-promoted)', async () => {
    const cookie = await t.signIn('viewer');
    const [name, value = ''] = cookie.split('=');
    const decoded = decodeURIComponent(value).replace('"viewer"', '"admin"');
    const forged = `${name}=${encodeURIComponent(decoded)}`;
    const me = SessionResponse.parse(await (await t.as(forged, '/api/session')).json());
    expect(me.user).toBeNull();
  });

  it('sign-out revokes the session', async () => {
    const cookie = await t.signIn('admin');
    await t.as(cookie, '/api/session', { method: 'DELETE' });
    const me = SessionResponse.parse(await (await t.as(cookie, '/api/session')).json());
    expect(me.user).toBeNull();
  });

  it('requires sign-in for data routes (FR-1)', async () => {
    expect((await t.app.request('/api/routes')).status).toBe(401);
    const cookie = await t.signIn('viewer');
    expect((await t.as(cookie, '/api/routes')).status).toBe(200);
  });
});

describe('requireRole (NFR-6, NFR-14)', () => {
  const app = (role: 'admin' | 'viewer' | null) =>
    new Hono<AuthEnv>()
      .use(async (c, next) => {
        c.set('user', role ? { name: 'U', role } : null);
        await next();
      })
      .post('/x', requireRole('admin'), (c) => c.json({ ok: true }));

  it('lets admins through', async () => {
    expect((await app('admin').request('/x', { method: 'POST' })).status).toBe(200);
  });

  it('blocks viewers with 403 and signed-out users with 401', async () => {
    const res = await app('viewer').request('/x', { method: 'POST' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Only Admins can change routes' });
    expect((await app(null).request('/x', { method: 'POST' })).status).toBe(401);
  });
});
