import { createContext, type ReactNode, useContext } from 'react';
import type { GatewayClient } from './client';

const GatewayContext = createContext<GatewayClient | null>(null);

export function GatewayProvider({
  client,
  children,
}: {
  client: GatewayClient;
  children: ReactNode;
}) {
  return <GatewayContext.Provider value={client}>{children}</GatewayContext.Provider>;
}

/** The one way screens reach the gateway (D1). */
export function useGateway(): GatewayClient {
  const client = useContext(GatewayContext);
  if (!client) throw new Error('useGateway outside GatewayProvider');
  return client;
}
