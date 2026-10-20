import { FeatureId, RouteChangeBody, RouteTarget } from '@gateway/contracts';
import { Hono } from 'hono';
import { type AuthEnv, requireRole } from '../auth/session';
import { RouteChangeError, type RoutingService } from '../routing/service';

export function routingRoutes(service: RoutingService) {
  return new Hono<AuthEnv>()
    .post('/routes/estimate', async (c) => {
      const body = RouteTarget.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return c.json({ error: 'Invalid route' }, 400);
      return c.json(await service.estimate(body.data.featureId, body.data.mainModelId));
    })
    .post('/routes/:featureId/changes', requireRole('admin'), async (c) => {
      const featureId = FeatureId.safeParse(c.req.param('featureId'));
      const body = RouteChangeBody.safeParse(await c.req.json().catch(() => null));
      if (!featureId.success || !body.success)
        return c.json({ error: 'Invalid route change' }, 400);
      const user = c.var.user;
      if (!user) return c.json({ error: 'Sign in first' }, 401);
      try {
        return c.json(await service.change(user, featureId.data, body.data));
      } catch (e) {
        if (e instanceof RouteChangeError) return c.json({ error: e.message }, e.status);
        throw e;
      }
    });
}
