import { describe, expect, it } from 'vitest';
import { HealthResponse } from './health';

describe('HealthResponse', () => {
  it('accepts ok', () => {
    expect(HealthResponse.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it('rejects anything else', () => {
    expect(HealthResponse.safeParse({ status: 'down' }).success).toBe(false);
  });
});
