import { afterEach, beforeEach } from 'vitest';
import { createApp } from './app';
import { type Database, openDatabase } from './db/client';
import { seedRoutingRules } from './db/seed';

/** Fresh in-memory PGlite with default rules for each test (D16.3). */
export function useTestApp() {
  const ctx = {} as { database: Database; app: ReturnType<typeof createApp> };
  beforeEach(async () => {
    ctx.database = await openDatabase();
    await seedRoutingRules(ctx.database.db);
    ctx.app = createApp({ db: ctx.database.db });
  });
  afterEach(() => ctx.database.close());
  return ctx;
}
