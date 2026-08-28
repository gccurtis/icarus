import type { Id } from "$representation/data/types/core/id";

/**
 * What a research thread is working toward, holding what it is working on.
 *
 * One field rather than a mode beside two optional ids, which would allow
 * `question` with no question and both ids at once.
 *
 * `discover` is a job, not an absence: it is how questions get found.
 */
export type ResearchMode =
  | { kind: "discover" }
  | { kind: "question"; questionId: Id<"questions"> }
  | { kind: "hypothesis"; hypothesisId: Id<"hypotheses"> };
