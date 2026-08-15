import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { resolveSelectedLines } from "$rich-content/api/shared/display-range";
import { setListMarks, validateListPresentation } from "$rich-content/api/shared/list";
import { record } from "$rich-content/api/shared/record";
import { commit, currentContent, nextRevision } from "$rich-content/api/shared/revisions";
import type { SetListInput } from "$rich-content/types/inputs";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Makes the selected lines list items.
 *
 * **Lines, not a range.** A list marker belongs to a whole line, so the
 * selection is widened to the lines it touches — and a selection ending exactly
 * at the start of a line does not include that line, because dragging to the
 * beginning of the next one is not a request to make it an item.
 *
 * A selection adjacent to a matching list joins it rather than starting a new
 * one, which is what makes ordered numbering continue instead of restarting.
 */
export const setList = async (
  scope: Scope,
  input: SetListInput
): Promise<ContentMutationResult> =>
  record("setList", { contentId: input?.contentId, kind: input?.presentation?.kind }, async () => {
    validateListPresentation(input.presentation);
    const database = await projectDatabase(scope.projectId);
    const current = await currentContent(database, input.contentId, input.expectedVersion);
    const lines = resolveSelectedLines(current, input.range);
    const marks = setListMarks(current, lines, input.presentation);
    return commit(database, current, nextRevision(current, { marks }));
  });
