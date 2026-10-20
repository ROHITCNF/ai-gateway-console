import type { Feature, FeatureId, Model, ModelId } from './entities';

/**
 * EXAMPLE PRICES, NOT REAL ONES (D3). USD per 1 million tokens.
 * This is the only place prices live; change them here.
 */
export const MODELS: readonly Model[] = [
  {
    id: 'claude-opus',
    displayName: 'Claude Opus',
    provider: 'Anthropic',
    inputPricePerMillion: 15,
    outputPricePerMillion: 75,
  },
  {
    id: 'claude-sonnet',
    displayName: 'Claude Sonnet',
    provider: 'Anthropic',
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
  },
  {
    id: 'claude-haiku',
    displayName: 'Claude Haiku',
    provider: 'Anthropic',
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4,
  },
  {
    id: 'gpt',
    displayName: 'GPT',
    provider: 'OpenAI',
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10,
  },
  {
    id: 'gemini',
    displayName: 'Gemini',
    provider: 'Google',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5,
  },
  {
    id: 'grok',
    displayName: 'Grok',
    provider: 'xAI',
    inputPricePerMillion: 3,
    outputPricePerMillion: 15,
  },
  {
    id: 'self-hosted',
    displayName: 'Llama (self-hosted)',
    provider: 'Self-hosted',
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 0.2,
  },
];

/** Features and owning teams (D13.3). */
export const FEATURES: readonly Feature[] = [
  { id: 'support-bot', displayName: 'support-bot', team: 'Customer Support' },
  { id: 'code-review', displayName: 'code-review', team: 'Developer Platform' },
  { id: 'search-summary', displayName: 'search-summary', team: 'Search' },
  { id: 'invoice-reader', displayName: 'invoice-reader', team: 'Payments' },
  { id: 'onboarding-helper', displayName: 'onboarding-helper', team: 'Growth' },
];

const modelsById = new Map(MODELS.map((m) => [m.id, m]));
const featuresById = new Map(FEATURES.map((f) => [f.id, f]));

export function getModel(id: ModelId): Model {
  const model = modelsById.get(id);
  if (!model) throw new Error(`Unknown model ${id}`);
  return model;
}

export function getFeature(id: FeatureId): Feature {
  const feature = featuresById.get(id);
  if (!feature) throw new Error(`Unknown feature ${id}`);
  return feature;
}
