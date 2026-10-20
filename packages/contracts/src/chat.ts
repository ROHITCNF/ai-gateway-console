import { z } from 'zod';
import { FeatureId, ModelId } from './entities';
import { RequestFilters } from './filters';

/**
 * The fixed list of actions the chat panel may return (NFR-7). The client rejects anything else.
 * None of them applies a change: a proposal only opens the review step (FR-26, NFR-5).
 */
export const ChatAction = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('filter'), filters: RequestFilters }),
  z.object({ kind: z.literal('answer') }),
  z.object({
    kind: z.literal('propose_route_change'),
    featureId: FeatureId,
    mainModelId: ModelId,
    fallbackModelId: ModelId,
  }),
  z.object({ kind: z.literal('show_route'), featureId: FeatureId }),
  z.object({ kind: z.literal('refuse') }),
  z.object({ kind: z.literal('not_understood') }),
]);
export type ChatAction = z.infer<typeof ChatAction>;
export type ChatActionKind = ChatAction['kind'];

export const CHAT_ACTION_KINDS = [
  'filter',
  'answer',
  'propose_route_change',
  'show_route',
  'refuse',
  'not_understood',
] as const satisfies readonly ChatActionKind[];

export const ProposedChange = z.object({
  featureId: FeatureId,
  mainModelId: ModelId,
  fallbackModelId: ModelId,
});
export type ProposedChange = z.infer<typeof ProposedChange>;

/** spec §4 ChatMessage. */
export const ChatMessage = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  /** What the panel understood, e.g. "Filter: feature = support-bot, status = failed" (FR-28). */
  understood: z.string().nullable(),
  proposedChange: ProposedChange.nullable(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;
