import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { ApplyStyleInput } from "#rich-content/types/runtime-inputs.js";
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
import { addStyleMark, validateStyle } from "#rich-content/runtime-api/shared/style.js";

export const applyStyle = async (
  store: RichContentStore,
  ids: RichContentIdFactory,
  input: ApplyStyleInput
): Promise<ContentMutationResult> => {
  const properties = validateStyle(input.properties);
  const current = await currentContent(store, input.contentId, input.expectedVersion);
  const range = resolveDisplayRange(current, input.range);
  requireNonEmptyRange(current, range);
  const marks = addStyleMark(current.marks, range, properties, ids);
  return commit(store, current, nextRevision(current, { marks }));
};
