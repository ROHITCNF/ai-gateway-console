import type { FeatureId, RouteChange } from '@gateway/contracts';
import type { ReviewTarget } from '@/store';

/** Ids of the latest change per feature: the only ones that can be undone (FR-23). */
export function undoableIds(changes: readonly RouteChange[]): Set<string> {
  const seen = new Set<FeatureId>();
  const ids = new Set<string>();
  for (const c of changes) {
    if (seen.has(c.featureId)) continue;
    seen.add(c.featureId);
    ids.add(c.id);
  }
  return ids;
}

/** Undo restores both the old main and old backup, as a new change with source `undo` (D13.12). */
export function undoTarget(c: RouteChange): ReviewTarget {
  return {
    featureId: c.featureId,
    mainModelId: c.oldMainModelId,
    fallbackModelId: c.oldFallbackModelId,
    source: 'undo',
  };
}
