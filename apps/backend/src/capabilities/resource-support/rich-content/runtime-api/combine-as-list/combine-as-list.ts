import { RichContentError } from "#rich-content/errors.js";
import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { CombineAsListInput } from "#rich-content/types/runtime-inputs.js";
import type { ContentMutationResult } from "#rich-content/types/runtime-results.js";
import { combineRawContentAsList } from "#rich-content/runtime-api/combine-as-list/combine-raw-content.js";
import { validateListPresentation } from "#rich-content/runtime-api/shared/list.js";
import {
  currentContent,
  resultOf,
  throwCommitConflict
} from "#rich-content/runtime-api/shared/revisions.js";

export const combineAsList = async (
  store: RichContentStore,
  ids: RichContentIdFactory,
  input: CombineAsListInput
): Promise<ContentMutationResult> => {
  validateListPresentation(input.presentation);
  if (
    input.items.length === 0 ||
    new Set(input.items.map(({ contentId }) => contentId)).size !== input.items.length
  ) {
    throw new RichContentError(
      "invalid-list-source",
      "List sources must be non-empty and unique"
    );
  }
  const sources = await Promise.all(
    input.items.map(({ contentId, expectedVersion }) =>
      currentContent(store, contentId, expectedVersion)
    )
  );
  const combined = combineRawContentAsList(
    sources,
    ids.contentId(),
    input.presentation,
    ids
  );
  const replaced = await store.replaceManyWithOne(
    input.items.map(({ contentId, expectedVersion }) => ({
      id: contentId,
      expectedVersion
    })),
    combined
  );
  if (!replaced) throwCommitConflict(combined.id);
  return resultOf(combined);
};
