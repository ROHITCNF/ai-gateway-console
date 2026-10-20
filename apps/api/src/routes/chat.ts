import { ChatBody } from '@gateway/contracts';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth/session';
import type { ChatService } from '../chat/service';

/** `POST /api/chat` (D6, D15.10). Read-only: it proposes, never applies (FR-26, NFR-5). */
export function chatRoutes(service: ChatService) {
  return new Hono<AuthEnv>().post('/chat', async (c) => {
    const body = ChatBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'Type a message of up to 500 characters' }, 400);
    const user = c.var.user;
    if (!user) return c.json({ error: 'Sign in first' }, 401);
    return c.json(await service.respond(user, body.data));
  });
}
