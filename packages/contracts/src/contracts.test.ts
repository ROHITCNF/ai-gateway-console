import { describe, expect, it } from 'vitest';
import {
  ChatAction,
  ChatResponse,
  GatewayRequest,
  RequestsQuery,
  RouteChange,
  User,
} from './index';

const request: GatewayRequest = {
  id: 'req_1',
  timestamp: 1_760_000_000_000,
  featureId: 'support-bot',
  team: 'Customer Support',
  plannedModelId: 'claude-opus',
  servedModelId: 'claude-sonnet',
  status: 'fallback',
  latencyMs: 8930,
  inputTokens: 1200,
  outputTokens: 900,
  cost: 0.0126,
  errorReason: 'timeout',
};

describe('entities', () => {
  it('accepts a fallback request', () => {
    expect(GatewayRequest.parse(request)).toEqual(request);
  });

  it('rejects unknown models and statuses', () => {
    expect(GatewayRequest.safeParse({ ...request, servedModelId: 'llama' }).success).toBe(false);
    expect(GatewayRequest.safeParse({ ...request, status: 'ok' }).success).toBe(false);
  });

  it('requires a non-empty user name and a known role', () => {
    expect(User.safeParse({ name: '  ', role: 'admin' }).success).toBe(false);
    expect(User.safeParse({ name: 'Priya', role: 'owner' }).success).toBe(false);
    expect(User.parse({ name: ' Priya ', role: 'viewer' })).toEqual({
      name: 'Priya',
      role: 'viewer',
    });
  });

  it('accepts a route change with source', () => {
    const change: RouteChange = {
      id: 'chg_1',
      timestamp: new Date(0).toISOString(),
      changedBy: 'Priya',
      featureId: 'support-bot',
      oldMainModelId: 'claude-opus',
      newMainModelId: 'claude-haiku',
      oldFallbackModelId: 'claude-sonnet',
      newFallbackModelId: 'claude-sonnet',
      source: 'chat',
      estimatedCostChangePercent: -80,
    };
    expect(RouteChange.parse(change)).toEqual(change);
    expect(RouteChange.safeParse({ ...change, source: 'api' }).success).toBe(false);
  });
});

describe('api shapes', () => {
  it('coerces request query params', () => {
    expect(RequestsQuery.parse({ since: '42' })).toEqual({ since: 42, limit: 10_000 });
    expect(RequestsQuery.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('only allows actions from the fixed list (NFR-7)', () => {
    expect(ChatAction.safeParse({ kind: 'apply_route_change' }).success).toBe(false);
    expect(
      ChatResponse.parse({
        understood: 'Show route: support-bot',
        reply: 'Here is the current route.',
        action: { kind: 'show_route', featureId: 'support-bot' },
      }).action.kind,
    ).toBe('show_route');
  });
});
