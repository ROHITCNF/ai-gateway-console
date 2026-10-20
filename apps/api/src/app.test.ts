import { HealthResponse } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { useTestApp } from './test-utils';

describe('GET /api/health', () => {
  const t = useTestApp();

  it('returns ok', async () => {
    const res = await t.app.request('/api/health');
    expect(res.status).toBe(200);
    expect(HealthResponse.parse(await res.json())).toEqual({ status: 'ok' });
  });
});
