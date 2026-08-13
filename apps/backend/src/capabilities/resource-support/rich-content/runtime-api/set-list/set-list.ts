import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { SetListInput } from "#rich-content/types/runtime-inputs.js";
import type { ContentMutationResult } from "#rich-content/types/runtime-results.js";
import { resolveSelectedLines } from "#rich-content/runtime-api/shared/display-range.js";
import {
  setListMarks,
  validateListPresentation
} from "#rich-content/runtime-api/shared/list.js";
import {
  commit,
  currentContent,
  nextRevision
} from "#rich-content/runtime-api/shared/revisions.js";

export const setList = async (
  store: RichContentStore,
  ids: RichContentIdFactory,
  input: SetListInput
): Promise<ContentMutationResult> => {
  validateListPresentation(input.presentation);
  const current = await currentContent(store, input.contentId, input.expectedVersion);
  const lines = resolveSelectedLines(current, input.range);
  const marks = setListMarks(current, lines, input.presentation, ids);
  return commit(store, current, nextRevision(current, { marks }));
};
