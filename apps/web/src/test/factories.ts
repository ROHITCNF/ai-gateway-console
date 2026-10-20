import type { GatewayRequest } from '@gateway/contracts';

let n = 0;

export function makeRequest(patch: Partial<GatewayRequest> = {}): GatewayRequest {
  n++;
  return {
    id: `req_${n.toString().padStart(6, '0')}`,
    timestamp: Date.now() - n * 1000,
    featureId: 'support-bot',
    team: 'Customer Support',
    plannedModelId: 'claude-opus',
    servedModelId: 'claude-opus',
    status: 'success',
    latencyMs: 1284,
    inputTokens: 1200,
    outputTokens: 720,
    cost: 0.072,
    errorReason: null,
    ...patch,
  };
}
