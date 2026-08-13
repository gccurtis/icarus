import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { RemoveLinkInput } from "#rich-content/types/runtime-inputs.js";
import type { ContentMutationResult } from "#rich-content/types/runtime-results.js";
import {
  requireNonEmptyRange,
  resolveDisplayRange
} from "#rich-content/runtime-api/shared/display-range.js";
import { removeLinksFromRange } from "#rich-content/runtime-api/shared/link.js";
import {
  commit,
  currentContent,
  nextRevision
} from "#rich-content/runtime-api/shared/revisions.js";

export const removeLink = async (
  store: RichContentStore,
  ids: RichContentIdFactory,
  input: RemoveLinkInput
): Promise<ContentMutationResult> => {
  const current = await currentContent(store, input.contentId, input.expectedVersion);
  const range = resolveDisplayRange(current, input.range);
  requireNonEmptyRange(current, range);
  const marks = removeLinksFromRange(current, range, ids);
  return commit(store, current, nextRevision(current, { marks }));
};
