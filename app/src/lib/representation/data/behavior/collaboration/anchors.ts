import type {
  AnchorWithin,
  TextAnchorSpan
} from "$representation/data/types/collaboration/anchor";

const validEnd = (value: unknown): value is { atom: string; offset: number } => {
  if (typeof value !== "object" || value === null) return false;
  const { atom, offset } = value as { atom?: unknown; offset?: unknown };
  return typeof atom === "string" && Number.isInteger(offset) && Number(offset) >= 0;
};

const validSpan = (value: unknown): value is TextAnchorSpan => {
  if (typeof value !== "object" || value === null) return false;
  const { blockId, from, to } = value as {
    blockId?: unknown;
    from?: unknown;
    to?: unknown;
  };
  return typeof blockId === "string" && blockId.length > 0 && validEnd(from) && validEnd(to);
};

/** Return only structurally usable spans from the current text-anchor representation. */
export const textAnchorSpans = (
  within: AnchorWithin | undefined
): readonly TextAnchorSpan[] => {
  if (within?.kind !== "text" || !Array.isArray(within.spans)) return [];
  return within.spans.filter(validSpan);
};

/** Canonicalizes stored input before a thread is edited or written again. */
export const canonicalAnchorWithin = (
  within: AnchorWithin | undefined
): AnchorWithin | undefined => {
  if (within === undefined || within.kind !== "text") return within;
  return { kind: "text", spans: [...textAnchorSpans(within)] };
};
