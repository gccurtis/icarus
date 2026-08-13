import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RemoveListInput } from "#rich-content/types/runtime-inputs.js";
import type { ContentMutationResult } from "#rich-content/types/runtime-results.js";
import { resolveSelectedLines } from "#rich-content/runtime-api/shared/display-range.js";
import { removeListMarks } from "#rich-content/runtime-api/shared/list.js";
import {
  commit,
  currentContent,
  nextRevision
} from "#rich-content/runtime-api/shared/revisions.js";

export const removeList = async (
  store: RichContentStore,
  input: RemoveListInput
): Promise<ContentMutationResult> => {
  const current = await currentContent(store, input.contentId, input.expectedVersion);
  const lines = resolveSelectedLines(current, input.range);
  const marks = removeListMarks(current, lines);
  return commit(store, current, nextRevision(current, { marks }));
};
