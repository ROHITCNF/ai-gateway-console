import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadSessionSecret } from './auth/secret';
import { loadConfig } from './config';
import { openDatabase } from './db/client';
import { seedRoutingRules } from './db/seed';
import { DevControls } from './dev/controls';
import { publishBatch } from './routes/stream';
import { RoutingService } from './routing/service';
import { Simulator } from './sim/runner';
import { StreamHub } from './stream/hub';

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
const hub = new StreamHub();
simulator.onBatch((batch) => publishBatch(hub, batch));
const dev = new DevControls(simulator, (state) => hub.broadcast('dev', state));
const routing = new RoutingService({
  db: database.db,
  shouldFail: () => dev.takeFailNext(),
  onChanged: (result) => {
    simulator.setRule(result.rule.featureId, result.rule.mainModelId, result.rule.fallbackModelId);
    hub.broadcast('route-change', result);
  },
});
if (config.simEnabled) simulator.start();
console.log(
  `simulator: ${config.simEnabled ? `on, ${config.simRate}/s, seed ${config.simSeed}` : 'off'}`,
);

serve(
  {
    fetch: createApp({
      db: database.db,
      hub,
      routing,
      dev,
      sessionSecret: loadSessionSecret(config.sessionSecret, '.data/session-secret'),
      secureCookie: config.secureCookie,
    }).fetch,
    port: config.port,
  },
  (info) => {
    console.log(`api listening on http://localhost:${info.port}`);
  },
);
