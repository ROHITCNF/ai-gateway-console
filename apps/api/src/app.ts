import type { HealthResponse } from '@gateway/contracts';
import { Hono } from 'hono';
import type { Db } from './db/client';
import { readRoutes } from './routes/read';
import { streamRoutes } from './routes/stream';
import type { StreamHub } from './stream/hub';

export interface AppDeps {
  db: Db;
  hub: StreamHub;
}

export function createApp(deps: AppDeps) {
  const app = new Hono().basePath('/api');

  app.get('/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse));
  app.route('/', readRoutes(deps.db));
  app.route('/', streamRoutes(deps.hub));

  return app;
}
