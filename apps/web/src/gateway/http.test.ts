import type { GatewayRequest } from '@gateway/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionStatus } from './client';
import { GatewayError } from './client';
import { HttpGatewayClient } from './http';

class FakeEventSource {
  static all: FakeEventSource[] = [];
  listeners = new Map<string, ((ev: Event) => void)[]>();
  onerror: ((ev: Event) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.all.push(this);
  }
  addEventListener(type: string, fn: (ev: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    const ev = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const fn of this.listeners.get(type) ?? []) fn(ev);
  }
  fail() {
    this.onerror?.(new Event('error'));
  }
  static last() {
    const es = FakeEventSource.all.at(-1);
    if (!es) throw new Error('no event source');
    return es;
  }
}

const req = (id: string, timestamp: number): GatewayRequest => ({
  id,
  timestamp,
  featureId: 'support-bot',
  team: 'Customer Support',
  plannedModelId: 'claude-opus',
  servedModelId: 'claude-opus',
  status: 'success',
  latencyMs: 100,
  inputTokens: 1,
  outputTokens: 1,
  cost: 0,
  errorReason: null,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('HttpGatewayClient', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let client: HttpGatewayClient;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.all = [];
    fetchMock = vi.fn<typeof fetch>();
    client = new HttpGatewayClient({
      fetch: fetchMock,
      eventSource: (url) => new FakeEventSource(url),
      retryDelays: [100, 200],
      clientId: 'c1',
    });
  });
  afterEach(() => vi.useRealTimers());

  it('calls the API and validates responses', async () => {
    fetchMock.mockResolvedValueOnce(json({ rules: [] }));
    expect(await client.getRoutes()).toEqual([]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/routes');

    fetchMock.mockResolvedValueOnce(json({ requests: [req('a', 1)], serverTime: 2 }));
    await client.getRequests({ since: 5, limit: 10 });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/requests?since=5&limit=10');

    fetchMock.mockResolvedValueOnce(json({ rules: 'nope' }));
    await expect(client.getRoutes()).rejects.toThrow();
  });

  it('turns HTTP errors into GatewayError with the server message', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'Only Admins can change routes' }, 403));
    const err = await client
      .changeRoute('support-bot', {
        mainModelId: 'gpt',
        fallbackModelId: 'gemini',
        source: 'click',
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GatewayError);
    expect(err).toMatchObject({ status: 403, message: 'Only Admins can change routes' });

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(client.getModels()).rejects.toMatchObject({ status: 0 });
  });

  it('streams batches and reports status', () => {
    const statuses: ConnectionStatus[] = [];
    const got: string[] = [];
    client.subscribe({
      onRequests: (r) => got.push(...r.map((x) => x.id)),
      onStatus: (s) => statuses.push(s),
    });
    const es = FakeEventSource.last();
    expect(es.url).toBe('/api/stream?clientId=c1');
    es.emit('hello', { connectionId: 'c1' });
    es.emit('requests', { requests: [req('a', 1), req('b', 2)] });
    expect(got).toEqual(['a', 'b']);
    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('reconnects after a drop and backfills with since = newest seen (FR-31)', async () => {
    const statuses: ConnectionStatus[] = [];
    const got: string[] = [];
    const unsubscribe = client.subscribe({
      onRequests: (r) => got.push(...r.map((x) => x.id)),
      onStatus: (s) => statuses.push(s),
    });
    const first = FakeEventSource.last();
    first.emit('hello', { connectionId: 'c1' });
    first.emit('requests', { requests: [req('a', 10)] });

    first.fail();
    expect(first.closed).toBe(true);
    expect(statuses.at(-1)).toBe('disconnected');

    vi.advanceTimersByTime(100);
    const refused = FakeEventSource.last();
    expect(refused).not.toBe(first);
    refused.fail();
    vi.advanceTimersByTime(200);
    const second = FakeEventSource.last();

    fetchMock.mockResolvedValueOnce(
      json({ requests: [req('b', 20), req('a', 10)], serverTime: 30 }),
    );
    second.emit('hello', { connectionId: 'c1' });
    await vi.waitFor(() => expect(statuses.at(-1)).toBe('connected'));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/requests?since=10&limit=50000');
    expect(got).toEqual(['a', 'b', 'a']);

    unsubscribe();
    expect(second.closed).toBe(true);
  });

  it('drops only its own connection id', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    await client.dropConnection(5);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/dev/drop');
    expect(JSON.parse(String(init?.body))).toEqual({ connectionId: 'c1', seconds: 5 });
  });
});
