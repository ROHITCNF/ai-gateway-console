import { cost, GatewayRequest } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../db/seed';
import { generateHistory, generateRequest, type RuleMap } from './engine';
import { createRng } from './rng';

const rules = Object.fromEntries(
  Object.entries(DEFAULT_RULES).map(([f, r]) => [
    f,
    { mainModelId: r.main, fallbackModelId: r.fallback },
  ]),
) as RuleMap;

const T0 = Date.UTC(2026, 9, 20, 9);
const sample = (seed = 42, n = 20_000) =>
  generateHistory(createRng(seed), n, T0, T0 + 3 * 3600_000, rules);

describe('simulator engine (D2)', () => {
  it('is repeatable with a fixed seed', () => {
    expect(sample(7, 200)).toEqual(sample(7, 200));
    expect(sample(7, 200)).not.toEqual(sample(8, 200));
  });

  it('produces valid requests, oldest first, inside the window', () => {
    const reqs = sample(1, 2000);
    for (const r of reqs) GatewayRequest.parse(r);
    expect(reqs.every((r, i) => i === 0 || (reqs[i - 1]?.timestamp ?? 0) <= r.timestamp)).toBe(
      true,
    );
    expect(reqs[0]?.timestamp).toBeGreaterThanOrEqual(T0);
    expect(reqs.at(-1)?.timestamp).toBeLessThan(T0 + 3 * 3600_000);
    expect(new Set(reqs.map((r) => r.id)).size).toBe(reqs.length);
  });

  it('fails 3–5% of requests and mostly falls back (D2)', () => {
    const reqs = sample();
    const notSuccess = reqs.filter((r) => r.status !== 'success').length / reqs.length;
    const fallbacks = reqs.filter((r) => r.status === 'fallback').length;
    const failed = reqs.filter((r) => r.status === 'failed').length;
    expect(notSuccess).toBeGreaterThan(0.03);
    expect(notSuccess).toBeLessThan(0.05);
    expect(fallbacks).toBeGreaterThan(failed);
    expect(failed).toBeGreaterThan(0);
  });

  it('follows routing rules and the outcome rules of D13.7', () => {
    for (const r of sample(3, 5000)) {
      const rule = rules[r.featureId];
      expect(r.plannedModelId).toBe(rule.mainModelId);
      if (r.status === 'success') {
        expect(r.servedModelId).toBe(rule.mainModelId);
        expect(r.errorReason).toBeNull();
      } else if (r.status === 'fallback') {
        expect(r.servedModelId).toBe(rule.fallbackModelId);
        expect(r.errorReason).not.toBeNull();
      } else {
        expect(r.servedModelId).toBeNull();
        expect(r.cost).toBe(0);
        expect(r.outputTokens).toBe(0);
      }
      if (r.servedModelId)
        expect(r.cost).toBe(cost(r.servedModelId, r.inputTokens, r.outputTokens));
    }
  });

  it('uses a new rule from the next request on (FR-20)', () => {
    const rng = createRng(5);
    const changed: RuleMap = {
      ...rules,
      'support-bot': { mainModelId: 'claude-haiku', fallbackModelId: 'gemini' },
    };
    const r = generateRequest(rng, T0, changed, 'support-bot');
    expect(r.plannedModelId).toBe('claude-haiku');
  });

  it('makes bigger models slower (D2)', () => {
    const avg = (main: 'claude-opus' | 'claude-haiku') => {
      const rng = createRng(9);
      const r2: RuleMap = {
        ...rules,
        'support-bot': { mainModelId: main, fallbackModelId: 'gpt' },
      };
      const reqs = Array.from({ length: 2000 }, () => generateRequest(rng, T0, r2, 'support-bot'));
      const ok = reqs.filter((r) => r.status === 'success');
      return ok.reduce((s, r) => s + r.latencyMs, 0) / ok.length;
    };
    expect(avg('claude-opus')).toBeGreaterThan(avg('claude-haiku') * 2);
  });
});
