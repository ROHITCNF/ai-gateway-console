import type { RouteChange } from '@gateway/contracts';
import { describe, expect, it } from 'vitest';
import { undoableIds, undoTarget } from './undo';

const c = (id: string, featureId: RouteChange['featureId']): RouteChange => ({
  id,
  timestamp: '2026-10-20T00:00:00.000Z',
  changedBy: 'P',
  featureId,
  oldMainModelId: 'claude-opus',
  newMainModelId: 'claude-haiku',
  oldFallbackModelId: 'claude-sonnet',
  newFallbackModelId: 'gemini',
  source: 'click',
  estimatedCostChangePercent: -90,
});

describe('undo (FR-23, D13.12)', () => {
  it('only the latest change per feature is undoable', () => {
    const ids = undoableIds([c('3', 'support-bot'), c('2', 'code-review'), c('1', 'support-bot')]);
    expect([...ids]).toEqual(['3', '2']);
  });

  it('restores both old main and old backup with source undo', () => {
    expect(undoTarget(c('1', 'support-bot'))).toEqual({
      featureId: 'support-bot',
      mainModelId: 'claude-opus',
      fallbackModelId: 'claude-sonnet',
      source: 'undo',
    });
  });
});
