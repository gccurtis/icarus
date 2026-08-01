import type { SlideChangeSet } from "./model.js";

export interface SlideRebaseDecision {
  allowed: boolean;
  conflictingIds: string[];
}

export const canRebase = (
  touchedIds: string[],
  intervening: SlideChangeSet[]
): SlideRebaseDecision => {
  const incoming = new Set(touchedIds);
  const conflicts = new Set<string>();
  for (const changeSet of intervening) {
    for (const id of changeSet.touchedIds) {
      if (incoming.has(id)) conflicts.add(id);
    }
  }
  return {
    allowed: conflicts.size === 0,
    conflictingIds: [...conflicts].sort()
  };
};
