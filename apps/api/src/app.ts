import type { HealthResponse } from '@gateway/contracts';
import { Hono } from 'hono';
import type { Db } from './db/client';
import { readRoutes } from './routes/read';

export interface AppDeps {
  db: Db;
}

export function createApp(deps: AppDeps) {
  const app = new Hono().basePath('/api');

  app.get('/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse));
  app.route('/', readRoutes(deps.db));

  return app;
}
