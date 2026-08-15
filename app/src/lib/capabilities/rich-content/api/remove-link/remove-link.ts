import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import {
  requireNonEmptyRange,
  resolveDisplayRange
} from "$rich-content/api/shared/display-range";
import { removeLinksFromRange } from "$rich-content/api/shared/link";
import { record } from "$rich-content/api/shared/record";
import { commit, currentContent, nextRevision } from "$rich-content/api/shared/revisions";
import type { RemoveLinkInput } from "$rich-content/types/inputs";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Removes any link covering a display selection.
 *
 * A link extending past the selection is split rather than deleted whole, so
 * unlinking part of a linked phrase leaves the rest linked.
 */
export const removeLink = async (
  scope: Scope,
  input: RemoveLinkInput
): Promise<ContentMutationResult> =>
  record("removeLink", { contentId: input?.contentId, expectedVersion: input?.expectedVersion }, async () => {
    const database = await projectDatabase(scope.projectId);
    const current = await currentContent(database, input.contentId, input.expectedVersion);
    const range = resolveDisplayRange(current, input.range);
    requireNonEmptyRange(current, range);
    const marks = removeLinksFromRange(current, range);
    return commit(database, current, nextRevision(current, { marks }));
  });
