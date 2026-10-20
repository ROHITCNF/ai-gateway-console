import { z } from 'zod';
import { ChatAction } from './chat';
import {
  ChangeSource,
  Feature,
  FeatureId,
  GatewayRequest,
  Model,
  ModelId,
  RouteChange,
  RoutingRule,
  User,
} from './entities';

/** Request and response shapes of every `/api` call (D15.1). */

export const ApiError = z.object({ error: z.string() });
export type ApiError = z.infer<typeof ApiError>;

// Session (D4, D15.7)
export const SignInBody = User;
export type SignInBody = z.infer<typeof SignInBody>;
export const SessionResponse = z.object({ user: User.nullable() });
export type SessionResponse = z.infer<typeof SessionResponse>;

// Read API (FR-29)
export const ModelsResponse = z.object({ models: z.array(Model) });
export type ModelsResponse = z.infer<typeof ModelsResponse>;
export const FeaturesResponse = z.object({ features: z.array(Feature) });
export type FeaturesResponse = z.infer<typeof FeaturesResponse>;
export const RoutesResponse = z.object({ rules: z.array(RoutingRule) });
export type RoutesResponse = z.infer<typeof RoutesResponse>;
export const HistoryResponse = z.object({ changes: z.array(RouteChange) });
export type HistoryResponse = z.infer<typeof HistoryResponse>;

/** `GET /api/requests?since=&limit=`: newest first; `since` = epoch ms, inclusive (FR-31). */
export const RequestsQuery = z.object({
  since: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(50_000).default(10_000),
});
export type RequestsQuery = z.infer<typeof RequestsQuery>;
export const RequestsResponse = z.object({
  requests: z.array(GatewayRequest),
  /** Server clock (epoch ms) when the page was read. */
  serverTime: z.number().int(),
});
export type RequestsResponse = z.infer<typeof RequestsResponse>;

// Route changes (FR-17..FR-20, FR-32, D13.10)
export const RouteTarget = z.object({
  featureId: FeatureId,
  mainModelId: ModelId,
  fallbackModelId: ModelId,
});
export type RouteTarget = z.infer<typeof RouteTarget>;

export const EstimateBasis = z.enum(['last_hour', 'all_data']);
export type EstimateBasis = z.infer<typeof EstimateBasis>;
export const EstimateResponse = z.object({
  /** Negative = cheaper. Null when the feature has no traffic. */
  percent: z.number().nullable(),
  basis: EstimateBasis,
  sampleSize: z.number().int().nonnegative(),
});
export type EstimateResponse = z.infer<typeof EstimateResponse>;

export const RouteChangeBody = z.object({
  mainModelId: ModelId,
  fallbackModelId: ModelId,
  source: ChangeSource,
});
export type RouteChangeBody = z.infer<typeof RouteChangeBody>;
export const RouteChangeResponse = z.object({ rule: RoutingRule, change: RouteChange });
export type RouteChangeResponse = z.infer<typeof RouteChangeResponse>;

// Developer controls (D13.8, D13.9, D13.14, D15.12)
export const RequestRate = z.union([z.literal(1), z.literal(5), z.literal(20)]);
export type RequestRate = z.infer<typeof RequestRate>;
export const DevState = z.object({ rate: RequestRate, failNextRouteChange: z.boolean() });
export type DevState = z.infer<typeof DevState>;
export const DevUpdateBody = DevState.partial();
export type DevUpdateBody = z.infer<typeof DevUpdateBody>;
export const DropBody = z.object({
  connectionId: z.string(),
  seconds: z.number().int().min(1).max(60),
});
export type DropBody = z.infer<typeof DropBody>;

// Live stream (FR-30, D15.6). SSE event name → data shape.
export const StreamHello = z.object({ connectionId: z.string() });
export type StreamHello = z.infer<typeof StreamHello>;
export const StreamRequests = z.object({ requests: z.array(GatewayRequest) });
export type StreamRequests = z.infer<typeof StreamRequests>;
export const StreamRouteChange = RouteChangeResponse;
export type StreamRouteChange = z.infer<typeof StreamRouteChange>;
export const StreamEvents = {
  hello: StreamHello,
  requests: StreamRequests,
  'route-change': StreamRouteChange,
  dev: DevState,
} as const;
export type StreamEventName = keyof typeof StreamEvents;

// Chat (D6, D15.10)
export const ChatBody = z.object({
  text: z.string().trim().min(1).max(500),
  /** Minutes east of UTC is `-getTimezoneOffset()`; lets "today" mean local midnight (D13.5). */
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).default(0),
});
export type ChatBody = z.infer<typeof ChatBody>;
export const ChatResponse = z.object({
  /** What the parser understood (FR-28). */
  understood: z.string(),
  /** The assistant's reply text. */
  reply: z.string(),
  action: ChatAction,
});
export type ChatResponse = z.infer<typeof ChatResponse>;
