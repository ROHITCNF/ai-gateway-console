import type { GatewayRequest, RouteChange, RoutingRule } from '@gateway/contracts';
import type { requests, routeChanges, routingRules } from './schema';

/** Row → contract shape. Values were validated against the contract enums when written. */

export function toRequest(row: typeof requests.$inferSelect): GatewayRequest {
  return row as GatewayRequest;
}

export function toRule(row: typeof routingRules.$inferSelect): RoutingRule {
  return { ...row, updatedAt: row.updatedAt.toISOString() } as RoutingRule;
}

export function toChange(row: typeof routeChanges.$inferSelect): RouteChange {
  return { ...row, timestamp: row.timestamp.toISOString() } as RouteChange;
}
