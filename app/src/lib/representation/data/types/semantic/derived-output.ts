import type { SemanticSpan } from "$representation/data/types/semantic/overlay";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";

/** Stored by value so an answer remains grounded after active rows are replaced. */
export type SemanticCitation = {
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  overlayGeneration: number;
};

export type DerivedState = "idle" | "generating" | "fresh" | "stale" | "error";
