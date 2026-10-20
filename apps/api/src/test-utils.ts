import type { Role } from '@gateway/contracts';
import { afterEach, beforeEach } from 'vitest';
import { createApp } from './app';
import { type Database, openDatabase } from './db/client';
import { seedRoutingRules } from './db/seed';
import { StreamHub } from './stream/hub';

export const TEST_SECRET = 'test-secret';

/** Fresh in-memory PGlite with default rules for each test (D16.3). */
export function useTestApp() {
  const ctx = {} as {
    database: Database;
    hub: StreamHub;
    app: ReturnType<typeof createApp>;
    /** Signs in and returns the Cookie header value. */
    signIn(role?: Role, name?: string): Promise<string>;
    /** Request with a signed-in cookie. */
    as(cookie: string, path: string, init?: RequestInit): Promise<Response>;
  };
  beforeEach(async () => {
    ctx.database = await openDatabase();
    await seedRoutingRules(ctx.database.db);
    ctx.hub = new StreamHub();
    ctx.app = createApp({ db: ctx.database.db, hub: ctx.hub, sessionSecret: TEST_SECRET });
  });
  afterEach(() => ctx.database.close());
  ctx.signIn = async (role = 'admin', name = 'Priya') => {
    const res = await ctx.app.request('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, role }),
    });
    const set = res.headers.get('set-cookie') ?? '';
    return set.split(';')[0] ?? '';
  };
  ctx.as = async (cookie, path, init = {}) =>
    ctx.app.request(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers, cookie },
    });
  return ctx;
}
