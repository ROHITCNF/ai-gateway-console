import { z } from 'zod';
import { FeatureId, ModelId, RequestStatus, Team } from './entities';

/** Time ranges (D13.5). `today` = since local midnight, offered by the chat panel. */
export const TimeRange = z.enum(['5m', '1h', 'all', 'today']);
export type TimeRange = z.infer<typeof TimeRange>;

/** Live Requests filters (FR-5, FR-6). Also what a chat "filter" action sets (FR-25). */
export const RequestFilters = z.object({
  featureId: FeatureId.nullable(),
  team: Team.nullable(),
  modelId: ModelId.nullable(),
  status: RequestStatus.nullable(),
  timeRange: TimeRange,
  requestId: z.string(),
});
export type RequestFilters = z.infer<typeof RequestFilters>;

export const EMPTY_FILTERS: RequestFilters = {
  featureId: null,
  team: null,
  modelId: null,
  status: null,
  timeRange: 'all',
  requestId: '',
};
