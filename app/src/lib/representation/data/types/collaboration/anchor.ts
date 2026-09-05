import type { Id } from "$representation/data/types/core/id";

export type AnchorEnd = { atom: string; offset: number };

export type TextAnchorSpan = {
  blockId: string;
  from: AnchorEnd;
  to: AnchorEnd;
};

export type TextAnchor = { kind: "text"; spans: TextAnchorSpan[] };

/** Read compatibility for comment threads written before text anchors became multi-block. */
export type LegacyTextAnchor = {
  kind: "text";
  blockId: string;
  from: AnchorEnd;
  to: AnchorEnd;
};

export type AnchorWithin =
  | { kind: "slide"; slideId: string }
  | { kind: "element"; elementId: string }
  | { kind: "cell"; rowId: string; columnId: string }
  | TextAnchor;

export type StoredAnchorWithin = AnchorWithin | LegacyTextAnchor;

export type Resolution = { by: Id<"users">; at: number };
