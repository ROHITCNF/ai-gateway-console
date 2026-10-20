import { describe, expect, it } from 'vitest';
import { estimateCostChange, type TokenSample } from './estimate';

const NOW = 10_000_000;
const sample = (n: number, ageMs: number): TokenSample[] =>
  Array.from({ length: n }, () => ({
    timestamp: NOW - ageMs,
    inputTokens: 1000,
    outputTokens: 1000,
  }));

describe('estimateCostChange (D13.10, NFR-14)', () => {
  it('prices the same tokens at both models', () => {
    // Opus 15+75 = 90 per 1M each; Haiku 0.8+4 = 4.8 → -94.67%.
    const e = estimateCostChange(sample(60, 1000), 'claude-opus', 'claude-haiku', NOW);
    expect(e).toEqual({ percent: -95, basis: 'last_hour', sampleSize: 60 });
  });

  it('is positive for a more expensive model and 0 for the same one', () => {
    expect(estimateCostChange(sample(60, 0), 'claude-haiku', 'claude-opus', NOW).percent).toBe(
      1775,
    );
    expect(estimateCostChange(sample(60, 0), 'gpt', 'gpt', NOW).percent).toBe(0);
  });

  it('uses the last hour when it has at least 50 requests', () => {
    const e = estimateCostChange(
      [...sample(50, 1000), ...sample(500, 2 * 3600_000)],
      'gpt',
      'gemini',
      NOW,
    );
    expect(e.basis).toBe('last_hour');
    expect(e.sampleSize).toBe(50);
  });

  it('falls back to all data when the last hour has fewer than 50', () => {
    const e = estimateCostChange(
      [...sample(49, 1000), ...sample(10, 2 * 3600_000)],
      'gpt',
      'gemini',
      NOW,
    );
    expect(e.basis).toBe('all_data');
    expect(e.sampleSize).toBe(59);
  });

  it('returns null with no traffic', () => {
    expect(estimateCostChange([], 'gpt', 'gemini', NOW)).toEqual({
      percent: null,
      basis: 'all_data',
      sampleSize: 0,
    });
  });
});
