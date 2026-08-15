import type { RichContentId } from "$rich-content/types/ids";

/**
 * What the mutating functions return.
 *
 * **A mutation reports identity and revision only.** The caller asks for
 * `display(contentId)` when it wants the projection, which keeps raw atoms and
 * marks off every mutation path — and means a caller that only needs to know the
 * write landed does not pay for a projection it will throw away.
 */
export interface ContentMutationResult {
  readonly contentId: RichContentId;
  readonly version: number;
}

/** `split` destroys its source and reports the two objects that replace it. */
export interface SplitContentResult {
  readonly left: ContentMutationResult;
  readonly right: ContentMutationResult;
}
