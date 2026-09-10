import type { AnchorWithin, TextAnchorSpan } from "$representation/data/types/collaboration/anchor";

/** Reads spans from an already-admitted current text anchor. */
export const textAnchorSpans = (
  within: AnchorWithin | undefined
): readonly TextAnchorSpan[] => {
  if (within?.kind !== "text") return [];
  return within.spans;
};

/** An empty text anchor is represented by an absent `within`, never by an empty span list. */
export const canonicalAnchorWithin = (
  within: AnchorWithin | undefined
): AnchorWithin | undefined => {
  if (within === undefined || within.kind !== "text") return within;
  return within.spans.length === 0 ? undefined : { kind: "text", spans: [...within.spans] };
};
