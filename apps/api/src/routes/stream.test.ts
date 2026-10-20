import type { GatewayRequest } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { StreamHub } from '../stream/hub';
import { publishBatch, streamRoutes } from './stream';

const req = (id: string, timestamp: number) =>
  ({
    id,
    timestamp,
    featureId: 'support-bot',
    team: 'Customer Support',
    plannedModelId: 'claude-opus',
    servedModelId: 'claude-opus',
    status: 'success',
    latencyMs: 1000,
    inputTokens: 10,
    outputTokens: 10,
    cost: 0.001,
    errorReason: null,
  }) satisfies GatewayRequest;

async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, needle: string) {
  const dec = new TextDecoder();
  let text = '';
  while (!text.includes(needle)) {
    const { value, done } = await reader.read();
    if (done) break;
    text += dec.decode(value);
  }
  return text;
}

describe('GET /api/stream (FR-30)', () => {
  it('sends hello, then request batches with the newest timestamp as id', async () => {
    const hub = new StreamHub();
    const app = streamRoutes(hub);
    const res = await app.request('/stream?clientId=c1');
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no body');

    const hello = await readUntil(reader, '\n\n');
    expect(hello).toContain('event: hello');
    expect(hello).toContain('"connectionId":"c1"');
    expect(hub.size).toBe(1);

    publishBatch(hub, [req('a', 100), req('b', 300), req('c', 200)]);
    const batch = await readUntil(reader, '\n\n');
    expect(batch).toContain('event: requests');
    expect(batch).toContain('id: 300');
    expect(batch).toContain('"id":"b"');

    expect(hub.close('c1')).toBe(true);
    await reader.cancel();
    expect(hub.size).toBe(0);
  });

  it('skips empty batches', () => {
    const hub = new StreamHub();
    let sent = 0;
    hub.add('x', { send: () => sent++, close: () => {} });
    publishBatch(hub, []);
    expect(sent).toBe(0);
  });
});
