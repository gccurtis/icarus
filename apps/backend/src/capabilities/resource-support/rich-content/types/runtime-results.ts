/**
 * What the mutating methods return. A mutation reports identity and revision
 * only; the caller asks for `display(contentId)` when it wants the projection.
 * That keeps raw atoms and marks off every mutation path.
 */
import type { RichContentId } from "#rich-content/types/ids.js";

export interface ContentMutationResult {
  readonly contentId: RichContentId;
  readonly version: number;
}

/** `split` destroys its source and reports the two objects that replace it. */
export interface SplitContentResult {
  readonly left: ContentMutationResult;
  readonly right: ContentMutationResult;
}
