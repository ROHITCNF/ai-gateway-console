import type { DevState } from '@gateway/contracts';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** Gateway-wide state other than requests: simulator settings (D13.14). */
export interface GatewayState {
  dev: DevState | null;
}

export const gatewayStore = createStore<GatewayState>()(() => ({ dev: null }));

export function useGatewayState<T>(selector: (s: GatewayState) => T): T {
  return useStore(gatewayStore, selector);
}
