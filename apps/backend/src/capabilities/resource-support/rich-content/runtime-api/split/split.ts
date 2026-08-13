import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { SplitContentInput } from "#rich-content/types/runtime-inputs.js";
import type { SplitContentResult } from "#rich-content/types/runtime-results.js";
import { splitRawContent } from "#rich-content/runtime-api/split/split-raw-content.js";
import { resolveDisplayPosition } from "#rich-content/runtime-api/shared/display-range.js";
import {
  currentContent,
  resultOf,
  throwCommitConflict
} from "#rich-content/runtime-api/shared/revisions.js";

export const split = async (
  store: RichContentStore,
  ids: RichContentIdFactory,
  input: SplitContentInput
): Promise<SplitContentResult> => {
  const current = await currentContent(store, input.contentId, input.expectedVersion);
  const at = resolveDisplayPosition(current, input.at);
  const parts = splitRawContent(
    current,
    at,
    ids.contentId(),
    ids.contentId(),
    ids
  );
  const replaced = await store.replaceOneWithTwo(
    { id: current.id, expectedVersion: current.version },
    parts.left,
    parts.right
  );
  if (!replaced) throwCommitConflict(current.id);
  return { left: resultOf(parts.left), right: resultOf(parts.right) };
};
