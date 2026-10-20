import type { HealthResponse } from '@gateway/contracts';
import { Hono } from 'hono';
import { type AuthEnv, requireSession, sessionMiddleware, sessionRoutes } from './auth/session';
import type { Db } from './db/client';
import { readRoutes } from './routes/read';
import { routingRoutes } from './routes/routing';
import { streamRoutes } from './routes/stream';
import type { RoutingService } from './routing/service';
import type { StreamHub } from './stream/hub';

export interface AppDeps {
  db: Db;
  hub: StreamHub;
  routing: RoutingService;
  sessionSecret: string;
  secureCookie?: boolean;
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AuthEnv>().basePath('/api');

  app.get('/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse));
  app.use('*', sessionMiddleware(deps.db, deps.sessionSecret));
  app.route('/', sessionRoutes(deps.db, deps.sessionSecret, deps.secureCookie ?? false));

  // Everything below needs a signed-in user (FR-1).
  app.use('*', requireSession);
  app.route('/', readRoutes(deps.db));
  app.route('/', streamRoutes(deps.hub));
  app.route('/', routingRoutes(deps.routing));

  return app;
}
