import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import {
  requireNonEmptyRange,
  resolveDisplayRange
} from "$rich-content/api/shared/display-range";
import { setLinkMark, validateAndCopyTargets } from "$rich-content/api/shared/link";
import { record } from "$rich-content/api/shared/record";
import { commit, currentContent, nextRevision } from "$rich-content/api/shared/revisions";
import type { SetLinkInput } from "$rich-content/types/inputs";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Points a display selection at one or more link targets.
 *
 * **Replaces rather than layers.** Unlike style, links do not stack: text
 * pointing at two places at once is not something a reader can act on, so any
 * link already covering the range is cut out before the new one is appended.
 *
 * Targets are validated and copied before the content is read — a stored mark
 * that shared the caller's array could change under the content.
 */
export const setLink = async (
  scope: Scope,
  input: SetLinkInput
): Promise<ContentMutationResult> =>
  record("setLink", { contentId: input?.contentId, targetCount: input?.targets?.length }, async () => {
    const targets = validateAndCopyTargets(input.targets);
    const database = await projectDatabase(scope.projectId);
    const current = await currentContent(database, input.contentId, input.expectedVersion);
    const range = resolveDisplayRange(current, input.range);
    requireNonEmptyRange(current, range);
    const marks = setLinkMark(current, range, targets);
    return commit(database, current, nextRevision(current, { marks }));
  });
