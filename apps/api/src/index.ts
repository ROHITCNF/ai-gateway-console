import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/client';
import { seedRoutingRules } from './db/seed';

const config = loadConfig();
const database = await openDatabase(
  config.databaseUrl ? { url: config.databaseUrl } : { dataDir: config.pgliteDir },
);
await seedRoutingRules(database.db);
console.log(
  `database: ${config.databaseUrl ? 'Postgres (DATABASE_URL)' : `PGlite at ${config.pgliteDir}`}`,
);

serve({ fetch: createApp().fetch, port: config.port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
