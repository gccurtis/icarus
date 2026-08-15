import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { resolveSelectedLines } from "$rich-content/api/shared/display-range";
import { removeListMarks } from "$rich-content/api/shared/list";
import { record } from "$rich-content/api/shared/record";
import { commit, currentContent, nextRevision } from "$rich-content/api/shared/revisions";
import type { RemoveListInput } from "$rich-content/types/inputs";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Stops the selected lines being list items.
 *
 * Removing the middle of a list leaves the lines on either side as two lists
 * sharing a `listId`, which `render-display` numbers as one sequence because
 * they are one — the ordinal restarts only when the id changes.
 */
export const removeList = async (
  scope: Scope,
  input: RemoveListInput
): Promise<ContentMutationResult> =>
  record("removeList", { contentId: input?.contentId, expectedVersion: input?.expectedVersion }, async () => {
    const database = await projectDatabase(scope.projectId);
    const current = await currentContent(database, input.contentId, input.expectedVersion);
    const lines = resolveSelectedLines(current, input.range);
    const marks = removeListMarks(current, lines);
    return commit(database, current, nextRevision(current, { marks }));
  });
