import type {
  ChatBody,
  ChatResponse,
  DevState,
  DevUpdateBody,
  EstimateResponse,
  Feature,
  FeatureId,
  GatewayRequest,
  Model,
  RouteChange,
  RouteChangeBody,
  RouteChangeResponse,
  RouteTarget,
  RoutingRule,
  User,
} from '@gateway/contracts';

/** Live stream state shown by the connection indicator and banner (FR-31). */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface StreamHandlers {
  /** New requests, live or backfilled after a reconnect. May repeat ids; the store dedupes. */
  onRequests(requests: GatewayRequest[]): void;
  onRouteChange?(result: RouteChangeResponse): void;
  onDev?(state: DevState): void;
  onStatus?(status: ConnectionStatus): void;
}

/**
 * The gateway client seam (D1, D15.5). Every screen reads data and sends route changes only
 * through this interface; screens never call `fetch`.
 */
export interface GatewayClient {
  getSession(): Promise<User | null>;
  signIn(user: User): Promise<User>;
  signOut(): Promise<void>;

  getModels(): Promise<Model[]>;
  getFeatures(): Promise<Feature[]>;
  getRoutes(): Promise<RoutingRule[]>;
  getHistory(): Promise<RouteChange[]>;
  /** Newest first. `since` = epoch ms, inclusive. */
  getRequests(opts?: { since?: number; limit?: number }): Promise<GatewayRequest[]>;

  estimate(target: RouteTarget): Promise<EstimateResponse>;
  /** Resolves only after the gateway confirms (FR-32). Rejects with `GatewayError` on failure. */
  changeRoute(featureId: FeatureId, body: RouteChangeBody): Promise<RouteChangeResponse>;

  chat(body: ChatBody): Promise<ChatResponse>;

  getDev(): Promise<DevState>;
  updateDev(body: DevUpdateBody): Promise<DevState>;
  /** Drops this client's live stream for `seconds` (D13.8). */
  dropConnection(seconds: number): Promise<void>;

  /** Follows the live stream; reconnects and backfills missed requests on its own (FR-30, FR-31). */
  subscribe(handlers: StreamHandlers): () => void;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}
