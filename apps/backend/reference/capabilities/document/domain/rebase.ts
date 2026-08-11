import type { DocumentChangeSet } from "./model.js";

export interface RebaseDecision {
  allowed: boolean;
  conflictingIds: string[];
}

export const canRebase = (
  touchedIds: string[],
  intervening: DocumentChangeSet[]
): RebaseDecision => {
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
