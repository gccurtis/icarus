import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { SetLinkInput } from "#rich-content/types/runtime-inputs.js";
import type { ContentMutationResult } from "#rich-content/types/runtime-results.js";
import {
  requireNonEmptyRange,
  resolveDisplayRange
} from "#rich-content/runtime-api/shared/display-range.js";
import { setLinkMark, validateAndCopyTargets } from "#rich-content/runtime-api/shared/link.js";
import {
  commit,
  currentContent,
  nextRevision
} from "#rich-content/runtime-api/shared/revisions.js";

export const setLink = async (
  store: RichContentStore,
  ids: RichContentIdFactory,
  input: SetLinkInput
): Promise<ContentMutationResult> => {
  const targets = validateAndCopyTargets(input.targets);
  const current = await currentContent(store, input.contentId, input.expectedVersion);
  const range = resolveDisplayRange(current, input.range);
  requireNonEmptyRange(current, range);
  const marks = setLinkMark(current, range, targets, ids);
  return commit(store, current, nextRevision(current, { marks }));
};
