import { DevUpdateBody, DropBody } from '@gateway/contracts';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth/session';
import type { DevControls } from '../dev/controls';
import type { StreamHub } from '../stream/hub';

/** Developer controls API (D13.8, D13.9, D13.14). Visible to every role. */
export function devRoutes(controls: DevControls, hub: StreamHub, now: () => number = Date.now) {
  return new Hono<AuthEnv>()
    .get('/dev', (c) => c.json(controls.state))
    .patch('/dev', async (c) => {
      const body = DevUpdateBody.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return c.json({ error: 'Invalid developer setting' }, 400);
      return c.json(controls.update(body.data));
    })
    .post('/dev/drop', async (c) => {
      const body = DropBody.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return c.json({ error: 'Invalid drop request' }, 400);
      // Only this client's stream drops (D15.12); the simulator keeps generating.
      hub.block(body.data.connectionId, now() + body.data.seconds * 1000);
      hub.close(body.data.connectionId);
      return c.json({ ok: true });
    });
}
