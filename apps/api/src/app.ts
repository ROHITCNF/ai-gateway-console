import type { HealthResponse } from '@gateway/contracts';
import { Hono } from 'hono';

export function createApp() {
  const app = new Hono().basePath('/api');

  app.get('/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse));

  return app;
}
