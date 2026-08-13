import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { RemoveStyleInput } from "#rich-content/types/runtime-inputs.js";
import type { ContentMutationResult } from "#rich-content/types/runtime-results.js";
import {
  requireNonEmptyRange,
  resolveDisplayRange
} from "#rich-content/runtime-api/shared/display-range.js";
import {
  commit,
  currentContent,
  nextRevision
} from "#rich-content/runtime-api/shared/revisions.js";
import { removeStyleProperties } from "#rich-content/runtime-api/shared/style.js";

export const removeStyle = async (
  store: RichContentStore,
  ids: RichContentIdFactory,
  input: RemoveStyleInput
): Promise<ContentMutationResult> => {
  const current = await currentContent(store, input.contentId, input.expectedVersion);
  const range = resolveDisplayRange(current, input.range);
  requireNonEmptyRange(current, range);
  const marks = removeStyleProperties(current, range, input.properties, ids);
  return commit(store, current, nextRevision(current, { marks }));
};
