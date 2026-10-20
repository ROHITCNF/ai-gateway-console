import {
  FEATURES,
  MODELS,
  type RequestStatus,
  type Team,
  type TimeRange,
} from '@gateway/contracts';

export const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'fallback', label: 'Fallback' },
];

export const TEAM_OPTIONS: Team[] = [...new Set(FEATURES.map((f) => f.team))];
export const FEATURE_OPTIONS = FEATURES.map((f) => ({ value: f.id, label: f.displayName }));
export const MODEL_OPTIONS = MODELS.map((m) => ({ value: m.id, label: m.displayName }));

export const TIME_LABEL: Record<TimeRange, string> = {
  '5m': 'Last 5 min',
  '1h': 'Last hour',
  all: 'All data',
  today: 'Today',
};

/** Time ranges offered by the toolbar (D13.5); `today` only appears when chat sets it. */
export const TIME_OPTIONS = [
  { value: '5m', label: '5 min' },
  { value: '1h', label: '1 hour' },
  { value: 'all', label: 'All data' },
] as const satisfies readonly { value: TimeRange; label: string }[];
