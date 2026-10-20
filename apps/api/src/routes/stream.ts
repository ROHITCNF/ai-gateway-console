import { randomUUID } from 'node:crypto';
import type { GatewayRequest, StreamHello, StreamRequests } from '@gateway/contracts';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { StreamHub } from '../stream/hub';

const KEEPALIVE_MS = 15_000;

/**
 * `GET /api/stream`: Server-Sent Events. Request batches arrive every ~250 ms (D7), each with
 * the newest timestamp as event id so a reconnecting client can backfill with `?since=` (FR-31).
 * `?clientId=` keeps a stable connection id across reconnects (used by "drop connection").
 */
export function streamRoutes(hub: StreamHub) {
  return new Hono().get('/stream', (c) => {
    const connectionId = c.req.query('clientId') || randomUUID();
    return streamSSE(c, async (stream) => {
      let done: () => void = () => {};
      const closed = new Promise<void>((resolve) => {
        done = resolve;
      });
      const remove = hub.add(connectionId, {
        send: (ev) => void stream.writeSSE(ev),
        close: () => {
          done();
          stream.abort();
        },
      });
      stream.onAbort(() => done());
      const hello: StreamHello = { connectionId };
      await stream.writeSSE({ event: 'hello', data: JSON.stringify(hello) });
      const ping = setInterval(() => void stream.write(': ping\n\n'), KEEPALIVE_MS);
      await closed;
      clearInterval(ping);
      remove();
    });
  });
}

/** Simulator batch → `requests` event. */
export function publishBatch(hub: StreamHub, batch: GatewayRequest[]): void {
  if (batch.length === 0) return;
  const newest = batch.reduce((m, r) => Math.max(m, r.timestamp), 0);
  hub.broadcast('requests', { requests: batch } satisfies StreamRequests, String(newest));
}
