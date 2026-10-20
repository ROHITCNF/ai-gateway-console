import {
  type ChatResponse,
  type DevState,
  FEATURES,
  type FeatureId,
  type GatewayRequest,
  MODELS,
  type RouteChange,
  type RouteChangeBody,
  type RouteChangeResponse,
  type RoutingRule,
  type User,
} from '@gateway/contracts';
import {
  type ConnectionStatus,
  type GatewayClient,
  GatewayError,
  type StreamHandlers,
} from './client';

const DEFAULT_RULES: RoutingRule[] = [
  {
    featureId: 'support-bot',
    mainModelId: 'claude-opus',
    fallbackModelId: 'claude-sonnet',
    updatedAt: '2026-10-20T09:00:00.000Z',
  },
  {
    featureId: 'code-review',
    mainModelId: 'claude-sonnet',
    fallbackModelId: 'gpt',
    updatedAt: '2026-10-20T09:00:00.000Z',
  },
  {
    featureId: 'search-summary',
    mainModelId: 'gemini',
    fallbackModelId: 'self-hosted',
    updatedAt: '2026-10-20T09:00:00.000Z',
  },
  {
    featureId: 'invoice-reader',
    mainModelId: 'gpt',
    fallbackModelId: 'claude-haiku',
    updatedAt: '2026-10-20T09:00:00.000Z',
  },
  {
    featureId: 'onboarding-helper',
    mainModelId: 'claude-haiku',
    fallbackModelId: 'gemini',
    updatedAt: '2026-10-20T09:00:00.000Z',
  },
];

type Method = keyof GatewayClient;

/**
 * In-memory gateway client for tests. Mirrors the backend's role check so UI tests see the same
 * 403 a crafted request would get (NFR-6).
 */
export class FakeGatewayClient implements GatewayClient {
  user: User | null;
  requests: GatewayRequest[];
  rules: RoutingRule[];
  history: RouteChange[] = [];
  dev: DevState = { rate: 1, failNextRouteChange: false };
  chatReply: ChatResponse = {
    understood: 'Not understood',
    reply: 'Sorry, I did not understand that.',
    action: { kind: 'not_understood' },
  };
  /** Set a method name to an error message to make it reject. */
  fail: Partial<Record<Method, string>> = {};
  calls: { method: Method; args: unknown[] }[] = [];
  #handlers = new Set<StreamHandlers>();

  constructor(
    init: { user?: User | null; requests?: GatewayRequest[]; rules?: RoutingRule[] } = {},
  ) {
    this.user = init.user ?? null;
    this.requests = init.requests ?? [];
    this.rules = init.rules ?? DEFAULT_RULES.map((r) => ({ ...r }));
  }

  get subscribers() {
    return this.#handlers.size;
  }

  async #run<T>(method: Method, args: unknown[], fn: () => T): Promise<T> {
    this.calls.push({ method, args });
    const err = this.fail[method];
    if (err) throw new GatewayError(err, 503);
    return fn();
  }

  getSession() {
    return this.#run('getSession', [], () => this.user);
  }
  signIn(user: User) {
    return this.#run('signIn', [user], () => {
      this.user = user;
      return user;
    });
  }
  signOut() {
    return this.#run('signOut', [], () => {
      this.user = null;
    });
  }
  getModels() {
    return this.#run('getModels', [], () => [...MODELS]);
  }
  getFeatures() {
    return this.#run('getFeatures', [], () => [...FEATURES]);
  }
  getRoutes() {
    return this.#run('getRoutes', [], () => this.rules.map((r) => ({ ...r })));
  }
  getHistory() {
    return this.#run('getHistory', [], () => [...this.history]);
  }
  getRequests(opts: { since?: number; limit?: number } = {}) {
    return this.#run('getRequests', [opts], () =>
      [...this.requests]
        .sort((a, b) => b.timestamp - a.timestamp)
        .filter((r) => opts.since === undefined || r.timestamp >= opts.since)
        .slice(0, opts.limit ?? 10_000),
    );
  }
  estimate(target: Parameters<GatewayClient['estimate']>[0]) {
    return this.#run('estimate', [target], () => ({
      percent: target.mainModelId === 'claude-opus' ? 400 : -80,
      basis: 'last_hour' as const,
      sampleSize: 120,
    }));
  }
  changeRoute(featureId: FeatureId, body: RouteChangeBody) {
    return this.#run('changeRoute', [featureId, body], (): RouteChangeResponse => {
      if (this.user?.role !== 'admin') throw new GatewayError('Only Admins can change routes', 403);
      const old = this.rules.find((r) => r.featureId === featureId);
      if (!old) throw new GatewayError('Unknown feature', 404);
      const rule: RoutingRule = {
        featureId,
        mainModelId: body.mainModelId,
        fallbackModelId: body.fallbackModelId,
        updatedAt: new Date().toISOString(),
      };
      const change: RouteChange = {
        id: `chg_${this.history.length + 1}`,
        timestamp: rule.updatedAt,
        changedBy: this.user.name,
        featureId,
        oldMainModelId: old.mainModelId,
        newMainModelId: body.mainModelId,
        oldFallbackModelId: old.fallbackModelId,
        newFallbackModelId: body.fallbackModelId,
        source: body.source,
        estimatedCostChangePercent: -80,
      };
      this.rules = this.rules.map((r) => (r.featureId === featureId ? rule : r));
      this.history = [change, ...this.history];
      return { rule, change };
    });
  }
  chat(body: Parameters<GatewayClient['chat']>[0]) {
    return this.#run('chat', [body], () => this.chatReply);
  }
  getDev() {
    return this.#run('getDev', [], () => this.dev);
  }
  updateDev(body: Parameters<GatewayClient['updateDev']>[0]) {
    return this.#run('updateDev', [body], () => {
      this.dev = { ...this.dev, ...body };
      return this.dev;
    });
  }
  dropConnection(seconds: number) {
    return this.#run('dropConnection', [seconds], () => {
      this.emitStatus('disconnected');
    });
  }
  subscribe(handlers: StreamHandlers) {
    this.#handlers.add(handlers);
    return () => {
      this.#handlers.delete(handlers);
    };
  }

  emitRequests(requests: GatewayRequest[]) {
    for (const h of this.#handlers) h.onRequests(requests);
  }
  emitStatus(status: ConnectionStatus) {
    for (const h of this.#handlers) h.onStatus?.(status);
  }
  emitRouteChange(result: RouteChangeResponse) {
    for (const h of this.#handlers) h.onRouteChange?.(result);
  }
  emitDev(state: DevState) {
    for (const h of this.#handlers) h.onDev?.(state);
  }
}
