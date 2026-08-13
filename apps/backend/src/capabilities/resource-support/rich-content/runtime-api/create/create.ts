import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { ContentMutationResult } from "#rich-content/types/runtime-results.js";
import { createRawContent } from "#rich-content/runtime-api/create/create-raw-content.js";
import { resultOf } from "#rich-content/runtime-api/shared/revisions.js";

export const create = async (
  store: RichContentStore,
  ids: RichContentIdFactory,
  initialText = ""
): Promise<ContentMutationResult> => {
  const content = createRawContent(ids.contentId(), initialText, ids);
  await store.create(content);
  return resultOf(content);
};
