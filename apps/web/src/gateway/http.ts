import {
  ChatResponse,
  DevState,
  EstimateResponse,
  FeaturesResponse,
  HistoryResponse,
  ModelsResponse,
  RequestsResponse,
  RouteChangeResponse,
  RoutesResponse,
  SessionResponse,
  StreamHello,
  StreamRequests,
  StreamRouteChange,
} from '@gateway/contracts';
import { z } from 'zod';
import {
  type ConnectionStatus,
  type GatewayClient,
  GatewayError,
  type StreamHandlers,
} from './client';

/** The part of `EventSource` the client uses; lets tests pass a fake. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (ev: Event) => void): void;
  close(): void;
  onerror: ((ev: Event) => void) | null;
}

export interface HttpGatewayOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  eventSource?: (url: string) => EventSourceLike;
  /** Reconnect delays in ms; the last one repeats. */
  retryDelays?: number[];
  clientId?: string;
}

/** Gateway client over HTTP + Server-Sent Events to `apps/api` (D15.5). */
export class HttpGatewayClient implements GatewayClient {
  readonly #base: string;
  readonly #fetch: typeof fetch;
  readonly #es: (url: string) => EventSourceLike;
  readonly #delays: number[];
  readonly clientId: string;

  constructor(opts: HttpGatewayOptions = {}) {
    this.#base = opts.baseUrl ?? '/api';
    this.#fetch = opts.fetch ?? ((...a) => fetch(...a));
    this.#es = opts.eventSource ?? ((url) => new EventSource(url, { withCredentials: true }));
    this.#delays = opts.retryDelays ?? [500, 1000, 2000, 4000];
    this.clientId = opts.clientId ?? crypto.randomUUID();
  }

  async #call<S extends z.ZodType>(
    schema: S,
    path: string,
    init?: RequestInit,
  ): Promise<z.infer<S>> {
    let res: Response;
    try {
      res = await this.#fetch(`${this.#base}${path}`, {
        credentials: 'same-origin',
        ...init,
        headers: init?.body ? { 'content-type': 'application/json' } : undefined,
      });
    } catch {
      throw new GatewayError('Cannot reach the gateway', 0);
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
      throw new GatewayError(msg, res.status);
    }
    return schema.parse(body);
  }

  #send<S extends z.ZodType>(schema: S, method: string, path: string, body: unknown) {
    return this.#call(schema, path, { method, body: JSON.stringify(body) });
  }

  async getSession() {
    return (await this.#call(SessionResponse, '/session')).user;
  }
  async signIn(user: Parameters<GatewayClient['signIn']>[0]) {
    const res = await this.#send(SessionResponse, 'POST', '/session', user);
    if (!res.user) throw new GatewayError('Sign-in failed', 500);
    return res.user;
  }
  async signOut() {
    await this.#call(SessionResponse, '/session', { method: 'DELETE' });
  }
  async getModels() {
    return (await this.#call(ModelsResponse, '/models')).models;
  }
  async getFeatures() {
    return (await this.#call(FeaturesResponse, '/features')).features;
  }
  async getRoutes() {
    return (await this.#call(RoutesResponse, '/routes')).rules;
  }
  async getHistory() {
    return (await this.#call(HistoryResponse, '/history')).changes;
  }
  async getRequests(opts: { since?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (opts.since !== undefined) q.set('since', String(opts.since));
    if (opts.limit !== undefined) q.set('limit', String(opts.limit));
    const qs = q.size ? `?${q}` : '';
    return (await this.#call(RequestsResponse, `/requests${qs}`)).requests;
  }
  estimate(target: Parameters<GatewayClient['estimate']>[0]) {
    return this.#send(EstimateResponse, 'POST', '/routes/estimate', target);
  }
  changeRoute(...[featureId, body]: Parameters<GatewayClient['changeRoute']>) {
    return this.#send(RouteChangeResponse, 'POST', `/routes/${featureId}/changes`, body);
  }
  chat(body: Parameters<GatewayClient['chat']>[0]) {
    return this.#send(ChatResponse, 'POST', '/chat', body);
  }
  getDev() {
    return this.#call(DevState, '/dev');
  }
  updateDev(body: Parameters<GatewayClient['updateDev']>[0]) {
    return this.#send(DevState, 'PATCH', '/dev', body);
  }
  async dropConnection(seconds: number) {
    await this.#call(z.unknown(), '/dev/drop', {
      method: 'POST',
      body: JSON.stringify({ connectionId: this.clientId, seconds }),
    });
  }

  subscribe(h: StreamHandlers): () => void {
    let es: EventSourceLike | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;
    let lastTs: number | null = null;
    let status: ConnectionStatus | null = null;
    let everConnected = false;

    const setStatus = (s: ConnectionStatus) => {
      if (s !== status) {
        status = s;
        h.onStatus?.(s);
      }
    };
    const seen = (reqs: { timestamp: number }[]) => {
      for (const r of reqs) if (lastTs === null || r.timestamp > lastTs) lastTs = r.timestamp;
    };
    const parse = <S extends z.ZodType>(schema: S, ev: Event) =>
      schema.parse(JSON.parse((ev as MessageEvent<string>).data));

    const connect = () => {
      if (stopped) return;
      setStatus(everConnected ? 'disconnected' : 'connecting');
      const src = this.#es(`${this.#base}/stream?clientId=${encodeURIComponent(this.clientId)}`);
      es = src;
      src.addEventListener('hello', async (ev) => {
        parse(StreamHello, ev);
        attempt = 0;
        const wasConnected = everConnected;
        everConnected = true;
        if (wasConnected && lastTs !== null) {
          // Fill in what we missed while disconnected (FR-31, D13.8).
          try {
            const missed = await this.getRequests({ since: lastTs, limit: 50_000 });
            if (stopped) return;
            seen(missed);
            if (missed.length) h.onRequests(missed);
          } catch {
            // Next batch still arrives; a later reconnect retries the backfill.
          }
        }
        if (!stopped && es === src) setStatus('connected');
      });
      src.addEventListener('requests', (ev) => {
        const { requests } = parse(StreamRequests, ev);
        seen(requests);
        h.onRequests(requests);
      });
      src.addEventListener('route-change', (ev) => h.onRouteChange?.(parse(StreamRouteChange, ev)));
      src.addEventListener('dev', (ev) => h.onDev?.(parse(DevState, ev)));
      src.onerror = () => {
        src.close();
        if (es !== src || stopped) return;
        es = null;
        if (everConnected) setStatus('disconnected');
        const delay = this.#delays[Math.min(attempt, this.#delays.length - 1)] ?? 1000;
        attempt++;
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      es?.close();
      es = null;
    };
  }
}
