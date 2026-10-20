import {
  FEATURES,
  type FeaturesResponse,
  type HistoryResponse,
  MODELS,
  type ModelsResponse,
  RequestsQuery,
  type RequestsResponse,
  type RoutesResponse,
} from '@gateway/contracts';
import { desc, gte } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client';
import { toChange, toRequest, toRule } from '../db/mappers';
import { requests, routeChanges, routingRules } from '../db/schema';

/** Read API (FR-29): models with prices, features, routes, history and requests. */
export function readRoutes(db: Db) {
  return new Hono()
    .get('/models', (c) => c.json({ models: [...MODELS] } satisfies ModelsResponse))
    .get('/features', (c) => c.json({ features: [...FEATURES] } satisfies FeaturesResponse))
    .get('/routes', async (c) => {
      const rows = await db.select().from(routingRules).orderBy(routingRules.featureId);
      return c.json({ rules: rows.map(toRule) } satisfies RoutesResponse);
    })
    .get('/history', async (c) => {
      const rows = await db.select().from(routeChanges).orderBy(desc(routeChanges.timestamp));
      return c.json({ changes: rows.map(toChange) } satisfies HistoryResponse);
    })
    .get('/requests', async (c) => {
      const q = RequestsQuery.safeParse(c.req.query());
      if (!q.success) return c.json({ error: 'Invalid query' }, 400);
      const serverTime = Date.now();
      const rows = await db
        .select()
        .from(requests)
        .where(q.data.since === undefined ? undefined : gte(requests.timestamp, q.data.since))
        .orderBy(desc(requests.timestamp), desc(requests.id))
        .limit(q.data.limit);
      return c.json({ requests: rows.map(toRequest), serverTime } satisfies RequestsResponse);
    });
}
