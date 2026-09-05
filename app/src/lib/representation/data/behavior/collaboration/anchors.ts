import type {
  AnchorWithin,
  StoredAnchorWithin,
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

/**
 * Returns the structural spans of either the current representation or the
 * single-block shape written by earlier clients.
 */
export const textAnchorSpans = (
  within: StoredAnchorWithin | undefined
): readonly TextAnchorSpan[] => {
  if (within?.kind !== "text") return [];
  if ("spans" in within) return within.spans.filter(validSpan);
  if (!validSpan(within)) return [];
  return [{ blockId: within.blockId, from: within.from, to: within.to }];
};

/** Canonicalizes stored input before a thread is edited or written again. */
export const canonicalAnchorWithin = (
  within: StoredAnchorWithin | undefined
): AnchorWithin | undefined => {
  if (within === undefined || within.kind !== "text") return within;
  return { kind: "text", spans: [...textAnchorSpans(within)] };
};
