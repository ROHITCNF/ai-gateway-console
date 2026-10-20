import {
  bigint,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/** Tables per D15.3. Column values use the enums in `@gateway/contracts`. */

export const routingRules = pgTable('routing_rules', {
  featureId: text('feature_id').primaryKey(),
  mainModelId: text('main_model_id').notNull(),
  fallbackModelId: text('fallback_model_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const routeChanges = pgTable(
  'route_changes',
  {
    id: text('id').primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    changedBy: text('changed_by').notNull(),
    featureId: text('feature_id').notNull(),
    oldMainModelId: text('old_main_model_id').notNull(),
    newMainModelId: text('new_main_model_id').notNull(),
    oldFallbackModelId: text('old_fallback_model_id').notNull(),
    newFallbackModelId: text('new_fallback_model_id').notNull(),
    source: text('source').notNull(),
    estimatedCostChangePercent: doublePrecision('estimated_cost_change_percent'),
  },
  (t) => [index('route_changes_timestamp_idx').on(t.timestamp)],
);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const requests = pgTable(
  'requests',
  {
    id: text('id').primaryKey(),
    /** Epoch milliseconds, matching `GatewayRequest.timestamp`. */
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    featureId: text('feature_id').notNull(),
    team: text('team').notNull(),
    plannedModelId: text('planned_model_id').notNull(),
    servedModelId: text('served_model_id'),
    status: text('status').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    cost: doublePrecision('cost').notNull(),
    errorReason: text('error_reason'),
  },
  (t) => [
    index('requests_timestamp_idx').on(t.timestamp),
    index('requests_feature_idx').on(t.featureId),
    index('requests_model_idx').on(t.servedModelId),
    index('requests_status_idx').on(t.status),
  ],
);
