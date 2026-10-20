import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Both drivers expose the same Drizzle query API, so the app sees one type.
 * Postgres via `DATABASE_URL` when set, PGlite otherwise (D16).
 */
export type Db = PgliteDatabase<typeof schema>;

export interface Database {
  db: Db;
  close(): Promise<void>;
}

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Opens the database and applies migrations. `url` undefined → PGlite in memory or at `dataDir`. */
export async function openDatabase(
  opts: { url?: string; dataDir?: string } = {},
): Promise<Database> {
  if (opts.url) {
    const sql = postgres(opts.url, { max: 5, onnotice: () => {} });
    const db = drizzlePostgres(sql, { schema });
    await migratePostgres(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => sql.end() };
  }
  if (opts.dataDir) mkdirSync(opts.dataDir, { recursive: true });
  const client = new PGlite(opts.dataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db, close: () => client.close() };
}
