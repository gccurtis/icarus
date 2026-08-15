import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { RichContentError } from "$rich-content/errors";
import { combineRawContentAsList } from "$rich-content/api/combine-as-list/combine-raw-content";
import { contentId } from "$rich-content/api/shared/ids";
import { validateListPresentation } from "$rich-content/api/shared/list";
import { record } from "$rich-content/api/shared/record";
import {
  currentContent,
  replaceManyWithOne,
  resultOf,
  throwCommitConflict
} from "$rich-content/api/shared/revisions";
import type { CombineAsListInput } from "$rich-content/types/inputs";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Folds several content objects into one list, in caller order.
 *
 * **Every source is destroyed** and replaced by a single new version-1 object,
 * which is why this reports one result rather than several.
 *
 * The whole replacement is **one transaction**, and each source is deleted at
 * the revision the caller expected. If any one of them moved, the entire combine
 * rolls back — combining a stale subset would silently discard whatever the
 * other writer had added to it.
 *
 * Duplicate sources are refused before anything is read: the same object twice
 * would be deleted once and counted twice, and the second delete would fail the
 * revision check for a reason that has nothing to do with concurrency.
 */
export const combineAsList = async (
  scope: Scope,
  input: CombineAsListInput
): Promise<ContentMutationResult> =>
  record("combineAsList", { itemCount: input?.items?.length, kind: input?.presentation?.kind }, async () => {
    validateListPresentation(input.presentation);
    if (
      input.items.length === 0 ||
      new Set(input.items.map(({ contentId: id }) => id)).size !== input.items.length
    ) {
      throw new RichContentError(
        "invalid-list-source",
        "List sources must be non-empty and unique"
      );
    }

    const database = await projectDatabase(scope.projectId);
    const sources = await Promise.all(
      input.items.map(({ contentId: id, expectedVersion }) =>
        currentContent(database, id, expectedVersion)
      )
    );
    const combined = combineRawContentAsList(sources, contentId(), input.presentation);

    const replaced = await replaceManyWithOne(
      database,
      input.items.map(({ contentId: id, expectedVersion }) => ({ id, expectedVersion })),
      combined
    );
    if (!replaced) throwCommitConflict(combined.id);

    return resultOf(combined);
  });
