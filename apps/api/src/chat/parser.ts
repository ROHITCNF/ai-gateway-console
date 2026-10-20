import type { FeatureId, ModelId, RequestStatus, Team, TimeRange } from '@gateway/contracts';

/**
 * Rule-based chat parser (D6, D15.10): pattern matching over a small list of known words. Pure
 * and synchronous; `ChatService` turns the intent into a reply and an allowed action (NFR-7).
 */

export interface ParsedFilters {
  featureId: FeatureId | null;
  team: Team | null;
  modelId: ModelId | null;
  status: RequestStatus | null;
  /** Null when the text names no time. */
  timeRange: TimeRange | null;
}

export type Intent =
  | { kind: 'filter'; filters: ParsedFilters }
  | { kind: 'cost'; filters: ParsedFilters }
  | { kind: 'move'; featureId: FeatureId | null; target: ModelId | 'cheaper' }
  | { kind: 'show_route'; featureId: FeatureId }
  | { kind: 'unknown' };

type Words<T> = readonly (readonly [T, readonly string[]])[];

// Longer phrases first inside each list; features before teams so "search-summary" is not "Search".
const FEATURE_WORDS: Words<FeatureId> = [
  ['support-bot', ['support-bot', 'support bot', 'supportbot']],
  ['code-review', ['code-review', 'code review', 'codereview']],
  ['search-summary', ['search-summary', 'search summary', 'searchsummary']],
  ['invoice-reader', ['invoice-reader', 'invoice reader', 'invoicereader', 'invoices?']],
  ['onboarding-helper', ['onboarding-helper', 'onboarding helper', 'onboardinghelper']],
];

const TEAM_WORDS: Words<Team> = [
  ['Customer Support', ['customer support', 'support team']],
  ['Developer Platform', ['developer platform', 'dev platform', 'platform team']],
  // Bare "search" is left out: "search for failed requests" is a verb, not the team.
  ['Search', ['search team']],
  ['Payments', ['payments?']],
  ['Growth', ['growth']],
];

const MODEL_WORDS: Words<ModelId> = [
  ['claude-opus', ['claude-opus', 'claude opus', 'opus']],
  ['claude-sonnet', ['claude-sonnet', 'claude sonnet', 'sonnet']],
  ['claude-haiku', ['claude-haiku', 'claude haiku', 'haiku']],
  ['gpt', ['gpt[\\w.-]*', 'openai', 'chatgpt']],
  ['gemini', ['gemini']],
  ['grok', ['grok']],
  ['self-hosted', ['self-hosted', 'self hosted', 'llama', 'local model']],
];

const STATUS_WORDS: Words<RequestStatus> = [
  ['fallback', ['fallbacks?', 'fell back', 'falling back', 'backup answered']],
  ['failed', ['failed', 'failures?', 'failing', 'errors?', 'errored']],
  ['success', ['successful', 'successes', 'success', 'succeeded']],
];

const TIME_WORDS: Words<TimeRange> = [
  ['today', ['today', 'since midnight']],
  ['5m', ['(?:last|past) 5 ?(?:minutes|mins?|m)', '5 ?(?:minutes|mins?|m)']],
  ['1h', ['(?:last|past) (?:hour|60 ?(?:minutes|mins?))', '(?:last|past) 1 ?(?:hour|h)', '1h']],
  ['all', ['all data', 'all time']],
];

const CHEAPER = /\b(?:cheaper|cheapest|cheap|less expensive|lower cost|save money)\b/;
const MOVE_VERB = /\b(?:move|switch|change|route|swap|put|use|migrate|set)\b/;
const MOVE_START = /^(?:please )?(?:move|switch|change|route|swap|put|use|migrate|set)\b/;
const ROUTE_QUESTION =
  /\b(?:route|routing|which model|what model|current model|main model|backup|uses?|using)\b/;
const COST_WORDS = /\b(?:cost|costs|costing|spend|spent|spending|how much|price|bill)\b/;
const FILTER_VERB = /\b(?:show|list|filter|find|display|only|see|give|get)\b/;

/** Lower-cased, punctuation stripped, single spaces. Keeps `-` and `.` for names like gpt-4.1. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function re(word: string) {
  return new RegExp(`(?<![\\w-])(?:${word})(?![\\w-])`, 'g');
}

/** Every match of a word list, with its position, removing matched text so later lists skip it. */
function take<T>(state: { text: string }, words: Words<T>): { value: T; at: number }[] {
  const found: { value: T; at: number }[] = [];
  for (const [value, phrases] of words) {
    for (const phrase of phrases) {
      state.text = state.text.replace(re(phrase), (m, at: number) => {
        found.push({ value, at });
        return ' '.repeat(m.length);
      });
    }
  }
  return found.sort((a, b) => a.at - b.at);
}

const first = <T>(xs: { value: T }[]) => xs[0]?.value ?? null;

export function parseIntent(input: string): Intent {
  const text = normalise(input);
  if (!text) return { kind: 'unknown' };
  const state = { text };
  const features = take(state, FEATURE_WORDS);
  const models = take(state, MODEL_WORDS);
  const statuses = take(state, STATUS_WORDS);
  const times = take(state, TIME_WORDS);
  const teams = take(state, TEAM_WORDS);
  const rest = state.text;

  const featureId = first(features);
  const cheaper = CHEAPER.test(rest);
  const plain = rest.replace(new RegExp(CHEAPER.source, 'g'), ' ');
  const asksCost = COST_WORDS.test(plain);

  // Route change: a move verb plus a target. A named model needs "to" or an imperative start, so
  // "does support-bot use opus?" stays a question. The last model named wins: "from opus to haiku".
  const lastModel = models.at(-1)?.value ?? null;
  const namedTarget = lastModel && (/\bto\b/.test(plain) || MOVE_START.test(plain.trim()));
  if (MOVE_VERB.test(plain) && !asksCost && (cheaper || namedTarget)) {
    return { kind: 'move', featureId, target: cheaper ? 'cheaper' : (lastModel as ModelId) };
  }

  const filters: ParsedFilters = {
    featureId,
    team: first(teams),
    modelId: first(models),
    status: first(statuses),
    timeRange: first(times),
  };

  if (asksCost) return { kind: 'cost', filters };

  if (featureId && ROUTE_QUESTION.test(rest) && !filters.status && !filters.timeRange) {
    return { kind: 'show_route', featureId };
  }

  const anyFilter =
    filters.featureId || filters.team || filters.modelId || filters.status || filters.timeRange;
  if (anyFilter || (FILTER_VERB.test(rest) && /\brequests?\b/.test(rest))) {
    return { kind: 'filter', filters };
  }
  return { kind: 'unknown' };
}
