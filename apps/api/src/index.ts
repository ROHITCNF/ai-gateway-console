import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db/client';
import { seedRoutingRules } from './db/seed';
import { Simulator } from './sim/runner';

const config = loadConfig();
const database = await openDatabase(
  config.databaseUrl ? { url: config.databaseUrl } : { dataDir: config.pgliteDir },
);
await seedRoutingRules(database.db);
console.log(
  `database: ${config.databaseUrl ? 'Postgres (DATABASE_URL)' : `PGlite at ${config.pgliteDir}`}`,
);

const simulator = new Simulator({ db: database.db, seed: config.simSeed, rate: config.simRate });
await simulator.init();
if (config.simEnabled) simulator.start();
console.log(
  `simulator: ${config.simEnabled ? `on, ${config.simRate}/s, seed ${config.simSeed}` : 'off'}`,
);

serve({ fetch: createApp().fetch, port: config.port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
