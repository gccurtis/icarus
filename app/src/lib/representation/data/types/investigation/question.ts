import type { Id } from "$representation/data/types/core/id";

/**
 * Where a question stands — the state of the *work*, not what was learned.
 * Conclusions are findings, not a status.
 *
 * There is no `parked`: a question nobody intends to pursue is deleted, and
 * `open` already covers one that is waiting.
 */
export type QuestionStatus = "open" | "investigating" | "answered";

/**
 * One thing related to a question. An id and nothing else — the relationship has
 * no grades, so it needs no label, no attribution, and no revision.
 */
export type RelatedItem =
  | { kind: "hypothesis"; id: Id<"hypotheses"> }
  | { kind: "finding"; id: Id<"findings"> };
