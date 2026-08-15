/**
 * Display Content: the public, read-only projection of Raw Content.
 *
 * This is what a consumer sees. It is **derived on every read and never
 * stored**, which is what lets the private representation change without
 * migrating anything.
 *
 * Line and segment ids embed the content version, so a handle taken from one
 * revision cannot address a later one. Every mutation accepting a `DisplayRange`
 * therefore also takes the version that produced it — a stale selection is
 * refused rather than silently applied somewhere else.
 */
import type { LinkTarget, ResolvedStyle } from "$rich-content/types/formatting";
import type {
  AtomId,
  DisplayLineId,
  DisplaySegmentId,
  ListId,
  RichContentId
} from "$rich-content/types/ids";

/**
 * A half-open UTF-16 range inside one text atom. A consumer obtains one from
 * `TextDisplaySegment.atomRange` and hands one back through `replaceText`.
 */
export interface AtomTextRange {
  readonly start: number;
  readonly end: number;
}

export interface DisplayPosition {
  readonly segmentId: DisplaySegmentId;
  readonly offset: number;
}

export interface DisplayRange {
  readonly start: DisplayPosition;
  readonly end: DisplayPosition;
}

/** The marker and separator a consumer renders before a line's segments. */
export interface DisplayListItem {
  readonly listId: ListId;
  readonly kind: "ordered" | "unordered";
  readonly marker: string;
  readonly separator: string;
}

export interface TextDisplaySegment {
  readonly id: DisplaySegmentId;
  readonly kind: "text";
  readonly atomId: AtomId;
  readonly atomRange: AtomTextRange;
  readonly text: string;
  readonly style: ResolvedStyle;
  readonly links: readonly LinkTarget[];
}

export type DisplaySegment = TextDisplaySegment;

export interface DisplayLine {
  readonly id: DisplayLineId;
  readonly list?: DisplayListItem;
  readonly segments: readonly DisplaySegment[];
}

export interface DisplayContent {
  readonly contentId: RichContentId;
  readonly version: number;
  readonly lines: readonly DisplayLine[];
}
