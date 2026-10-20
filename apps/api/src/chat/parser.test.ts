import { describe, expect, it } from 'vitest';
import { type ParsedFilters, parseIntent } from './parser';

const none: ParsedFilters = {
  featureId: null,
  team: null,
  modelId: null,
  status: null,
  timeRange: null,
};
const filter = (f: Partial<ParsedFilters>) => ({ kind: 'filter', filters: { ...none, ...f } });
const costQ = (f: Partial<ParsedFilters>) => ({ kind: 'cost', filters: { ...none, ...f } });

describe('chat parser: filters (FR-25, D6, NFR-14)', () => {
  it.each([
    [
      'show failed requests from support-bot today',
      filter({ featureId: 'support-bot', status: 'failed', timeRange: 'today' }),
    ],
    [
      'show failed requests from the payments team today',
      filter({ team: 'Payments', status: 'failed', timeRange: 'today' }),
    ],
    [
      'Fallbacks for code review in the last hour',
      filter({ featureId: 'code-review', status: 'fallback', timeRange: '1h' }),
    ],
    [
      'requests served by Haiku, past 5 minutes',
      filter({ modelId: 'claude-haiku', timeRange: '5m' }),
    ],
    ['only errors', filter({ status: 'failed' })],
    [
      'successful search-summary requests',
      filter({ featureId: 'search-summary', status: 'success' }),
    ],
    ['show requests from the search team', filter({ team: 'Search' })],
    ['Customer Support, all data', filter({ team: 'Customer Support', timeRange: 'all' })],
    ['gpt-4.1 failures', filter({ modelId: 'gpt', status: 'failed' })],
    ['llama requests', filter({ modelId: 'self-hosted' })],
    ['show all requests', filter({})],
    ['invoice reader last 5 min', filter({ featureId: 'invoice-reader', timeRange: '5m' })],
  ])('%s', (text, expected) => {
    expect(parseIntent(text)).toEqual(expected);
  });

  it('does not read "search" the verb as the Search team', () => {
    expect(parseIntent('search for failed requests')).toEqual(filter({ status: 'failed' }));
  });

  it('does not read "search-summary" as the Search team', () => {
    expect(parseIntent('search-summary today')).toEqual(
      filter({ featureId: 'search-summary', timeRange: 'today' }),
    );
  });
});

describe('chat parser: cost questions (FR-25, D6)', () => {
  it.each([
    [
      'how much did support-bot cost today',
      costQ({ featureId: 'support-bot', timeRange: 'today' }),
    ],
    [
      'How much did the payments team spend in the last hour?',
      costQ({ team: 'Payments', timeRange: '1h' }),
    ],
    ['total spend', costQ({})],
    [
      'what did opus cost in the past 5 minutes',
      costQ({ modelId: 'claude-opus', timeRange: '5m' }),
    ],
    ['cost of failed requests today', costQ({ status: 'failed', timeRange: 'today' })],
  ])('%s', (text, expected) => {
    expect(parseIntent(text)).toEqual(expected);
  });
});

describe('chat parser: route changes (FR-25, D13.11, D14.4)', () => {
  it.each([
    ['move support-bot to a cheaper model', 'support-bot', 'cheaper'],
    ['Switch code review to something cheaper', 'code-review', 'cheaper'],
    ['use the cheapest model for invoice-reader', 'invoice-reader', 'cheaper'],
    ['move support-bot to a lower cost model', 'support-bot', 'cheaper'],
    ['move support-bot to Grok', 'support-bot', 'grok'],
    ['please switch onboarding helper to gemini', 'onboarding-helper', 'gemini'],
    ['change support-bot from opus to haiku', 'support-bot', 'claude-haiku'],
    ['use sonnet for search-summary', 'search-summary', 'claude-sonnet'],
    ['route code-review to self hosted', 'code-review', 'self-hosted'],
  ])('%s', (text, featureId, target) => {
    expect(parseIntent(text)).toEqual({ kind: 'move', featureId, target });
  });

  it('keeps the feature null when none is named', () => {
    expect(parseIntent('move to a cheaper model')).toEqual({
      kind: 'move',
      featureId: null,
      target: 'cheaper',
    });
  });

  it('does not treat a question about a model as a move', () => {
    expect(parseIntent('does support-bot use opus?')).toEqual({
      kind: 'show_route',
      featureId: 'support-bot',
    });
  });
});

describe('chat parser: show route', () => {
  it.each([
    'what model does support-bot use',
    'which model is code-review using?',
    'show the route for invoice-reader',
    'current routing of onboarding-helper',
  ])('%s', (text) => {
    expect(parseIntent(text).kind).toBe('show_route');
  });
});

describe('chat parser: not understood (FR-27)', () => {
  it.each(['', '   ', 'hello', 'tell me a joke', 'what is the weather', 'delete everything now'])(
    '%j',
    (text) => {
      expect(parseIntent(text)).toEqual({ kind: 'unknown' });
    },
  );
});
