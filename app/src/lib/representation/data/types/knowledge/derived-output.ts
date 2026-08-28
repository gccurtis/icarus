/**
 * One thing a generated answer rests on, quoted.
 *
 * The text travels with the span: a citation exists to survive its source
 * changing, and a span alone resolves against content that may no longer say
 * what it said.
 */
export type DerivedEvidence = {
  resourceKind: string;
  resourceId: string;
  /** Absent means the whole thing. */
  span?: { start: number; end: number };
  text: string;
};

export type DerivedState = "idle" | "generating" | "fresh" | "stale" | "error";
