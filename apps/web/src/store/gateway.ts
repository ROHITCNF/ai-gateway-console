import type {
  ChangeSource,
  DevState,
  FeatureId,
  ModelId,
  RouteChange,
  RouteChangeResponse,
  RoutingRule,
} from '@gateway/contracts';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { GatewayClient } from '@/gateway';

/** A route change waiting in the review step (FR-18). */
export interface ReviewTarget {
  featureId: FeatureId;
  mainModelId: ModelId;
  fallbackModelId: ModelId;
  source: ChangeSource;
}

type Loadable<T> = { data: T | null; error: string | null };

/** Gateway-wide state other than requests: routes, history, review step, simulator settings. */
export interface GatewayState {
  dev: DevState | null;
  rules: Loadable<RoutingRule[]>;
  history: Loadable<RouteChange[]>;
  review: ReviewTarget | null;
  /** Review sent and waiting for the gateway's confirmation (FR-32). */
  confirming: boolean;
  /** Last error from the gateway for the open review. */
  reviewError: string | null;
  /** Per-feature error after a failed change; the old route stays (FR-32). */
  changeErrors: Partial<Record<FeatureId, string>>;
}

const initial: GatewayState = {
  dev: null,
  rules: { data: null, error: null },
  history: { data: null, error: null },
  review: null,
  confirming: false,
  reviewError: null,
  changeErrors: {},
};

export const gatewayStore = createStore<GatewayState>()(() => initial);

export function useGatewayState<T>(selector: (s: GatewayState) => T): T {
  return useStore(gatewayStore, selector);
}

export function resetGatewayState() {
  gatewayStore.setState(initial, true);
}

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export async function loadRules(client: GatewayClient) {
  try {
    const data = await client.getRoutes();
    gatewayStore.setState({ rules: { data, error: null } });
  } catch (e) {
    gatewayStore.setState((s) => ({
      rules: { data: s.rules.data, error: message(e, 'Could not load routes') },
    }));
  }
}

export async function loadHistory(client: GatewayClient) {
  try {
    const data = await client.getHistory();
    gatewayStore.setState({ history: { data, error: null } });
  } catch (e) {
    gatewayStore.setState((s) => ({
      history: { data: s.history.data, error: message(e, 'Could not load history') },
    }));
  }
}

/** Applies a confirmed change, from our own Confirm or another viewer's (stream). */
export function applyConfirmed({ rule, change }: RouteChangeResponse) {
  gatewayStore.setState((s) => ({
    rules: s.rules.data
      ? { ...s.rules, data: s.rules.data.map((r) => (r.featureId === rule.featureId ? rule : r)) }
      : s.rules,
    history: s.history.data
      ? s.history.data.some((c) => c.id === change.id)
        ? s.history
        : {
            ...s.history,
            data: [change, ...s.history.data].sort((a, b) =>
              b.timestamp.localeCompare(a.timestamp),
            ),
          }
      : s.history,
  }));
}

/** Opens the shared review step. Nothing changes yet (FR-18, FR-19). */
export function openReview(target: ReviewTarget) {
  gatewayStore.setState({ review: target, reviewError: null, confirming: false });
}

export function cancelReview() {
  if (gatewayStore.getState().confirming) return;
  gatewayStore.setState({ review: null, reviewError: null });
}

/**
 * Confirm: sends the change and shows the new route only after the gateway confirms (FR-32).
 * On failure the old route stays and the error is shown in the review and on the feature.
 */
export async function confirmReview(client: GatewayClient): Promise<boolean> {
  const { review, confirming } = gatewayStore.getState();
  if (!review || confirming) return false;
  gatewayStore.setState((s) => {
    const { [review.featureId]: _, ...rest } = s.changeErrors;
    return { confirming: true, reviewError: null, changeErrors: rest };
  });
  try {
    const result = await client.changeRoute(review.featureId, {
      mainModelId: review.mainModelId,
      fallbackModelId: review.fallbackModelId,
      source: review.source,
    });
    applyConfirmed(result);
    gatewayStore.setState({ confirming: false, review: null });
    return true;
  } catch (e) {
    const msg = message(e, 'The gateway did not accept this change');
    gatewayStore.setState((s) => ({
      confirming: false,
      reviewError: msg,
      changeErrors: { ...s.changeErrors, [review.featureId]: msg },
    }));
    return false;
  }
}
