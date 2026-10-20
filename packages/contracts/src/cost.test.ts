import { describe, expect, it } from 'vitest';
import { FEATURES, getModel, MODELS } from './catalog';
import { cost } from './cost';
import { FeatureId, Model, ModelId } from './entities';

describe('cost (NFR-14)', () => {
  it('prices input and output tokens per 1M', () => {
    // Opus: $15 in, $75 out per 1M.
    expect(cost('claude-opus', 1_000_000, 0)).toBe(15);
    expect(cost('claude-opus', 0, 1_000_000)).toBe(75);
    expect(cost('claude-opus', 1200, 720)).toBeCloseTo(0.018 + 0.054, 10);
  });

  it('is zero for zero tokens', () => {
    expect(cost('claude-sonnet', 0, 0)).toBe(0);
  });

  it('accepts a model object', () => {
    const custom: Model = { ...getModel('gpt'), inputPricePerMillion: 1, outputPricePerMillion: 2 };
    expect(cost(custom, 500_000, 500_000)).toBe(1.5);
  });

  it('makes bigger models cost more for the same tokens (D2)', () => {
    const c = (id: ModelId) => cost(id, 1000, 500);
    expect(c('claude-opus')).toBeGreaterThan(c('claude-sonnet'));
    expect(c('claude-sonnet')).toBeGreaterThan(c('claude-haiku'));
    expect(c('claude-haiku')).toBeGreaterThan(c('self-hosted'));
  });

  it('rejects negative tokens and unknown models', () => {
    expect(() => cost('gpt', -1, 0)).toThrow(RangeError);
    expect(() => cost('llama' as ModelId, 1, 1)).toThrow('Unknown model');
  });
});

describe('catalog', () => {
  it('has one valid entry per model and feature id (D13.2, D13.3)', () => {
    expect(MODELS.map((m) => Model.parse(m).id).sort()).toEqual([...ModelId.options].sort());
    expect(FEATURES.map((f) => f.id).sort()).toEqual([...FeatureId.options].sort());
  });
});
