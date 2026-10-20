import { HealthResponse } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await createApp().request('/api/health');
    expect(res.status).toBe(200);
    expect(HealthResponse.parse(await res.json())).toEqual({ status: 'ok' });
  });
});
