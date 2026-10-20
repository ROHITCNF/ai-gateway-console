import type { ErrorReason, GatewayRequest } from '@gateway/contracts';
import { modelName } from '@/lib/format';

const REASON: Record<ErrorReason, string> = {
  timeout: 'timed out',
  'rate limit': 'hit a rate limit',
  'server error': 'returned a server error',
};

/** Plain-language story of what happened to a request (FR-8, D13.7). Null for a plain success. */
export function explainRequest(r: GatewayRequest): { title: string; text: string } | null {
  const planned = modelName(r.plannedModelId);
  const reason = r.errorReason ? REASON[r.errorReason] : 'failed';
  if (r.status === 'fallback') {
    return {
      title: 'Why it fell back',
      text: `${planned} ${reason}, so the gateway sent the request to the backup model, ${modelName(r.servedModelId)}, which answered.`,
    };
  }
  if (r.status === 'failed') {
    return {
      title: 'Why it failed',
      text: `${planned} ${reason}, and the backup model failed too, so nothing answered. No cost was charged.`,
    };
  }
  return null;
}
