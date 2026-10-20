import { randomUUID } from 'node:crypto';
import { type Role, type SessionResponse, SignInBody, type User } from '@gateway/contracts';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { Db } from '../db/client';
import { sessions } from '../db/schema';

/**
 * Auth seam (D4, D15.7): the role picker creates a backend session; name and role travel in an
 * httpOnly signed cookie and the session row lets sign-out revoke it. Replace this one module to
 * add real sign-in.
 */

export const SESSION_COOKIE = 'gw_session';
const MAX_AGE_S = 7 * 24 * 3600;

export type AuthEnv = { Variables: { user: User | null } };

interface CookiePayload extends User {
  sid: string;
}

/** Reads the signed cookie and checks the session still exists. Sets `c.var.user`. */
export function sessionMiddleware(db: Db, secret: string) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    c.set('user', null);
    const raw = await getSignedCookie(c, secret, SESSION_COOKIE);
    if (raw) {
      try {
        const p = JSON.parse(raw) as CookiePayload;
        const [row] = await db.select().from(sessions).where(eq(sessions.id, p.sid));
        if (row) c.set('user', { name: row.name, role: row.role as Role });
      } catch {
        // Bad cookie: treat as signed out.
      }
    }
    await next();
  });
}

export const requireSession = createMiddleware<AuthEnv>(async (c, next) => {
  if (!c.var.user) return c.json({ error: 'Sign in first' }, 401);
  await next();
});

/** Role check in the backend (NFR-6). The UI only mirrors it. */
export function requireRole(role: Role) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.var.user;
    if (!user) return c.json({ error: 'Sign in first' }, 401);
    if (user.role !== role) return c.json({ error: 'Only Admins can change routes' }, 403);
    await next();
  });
}

export function sessionRoutes(db: Db, secret: string, secureCookie: boolean) {
  return new Hono<AuthEnv>()
    .get('/session', (c) => c.json({ user: c.var.user } satisfies SessionResponse))
    .post('/session', async (c) => {
      const body = SignInBody.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return c.json({ error: 'Name and role are required' }, 400);
      const sid = randomUUID();
      await db.insert(sessions).values({ id: sid, ...body.data });
      const payload: CookiePayload = { sid, ...body.data };
      await setSignedCookie(c, SESSION_COOKIE, JSON.stringify(payload), secret, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: secureCookie,
        path: '/',
        maxAge: MAX_AGE_S,
      });
      return c.json({ user: body.data } satisfies SessionResponse);
    })
    .delete('/session', async (c) => {
      const raw = await getSignedCookie(c, secret, SESSION_COOKIE);
      if (raw) {
        try {
          await db.delete(sessions).where(eq(sessions.id, (JSON.parse(raw) as CookiePayload).sid));
        } catch {
          // Already invalid.
        }
      }
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      return c.json({ user: null } satisfies SessionResponse);
    });
}
