import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import {
  requireNonEmptyRange,
  resolveDisplayRange
} from "$rich-content/api/shared/display-range";
import { record } from "$rich-content/api/shared/record";
import { commit, currentContent, nextRevision } from "$rich-content/api/shared/revisions";
import { addStyleMark, validateStyle } from "$rich-content/api/shared/style";
import type { ApplyStyleInput } from "$rich-content/types/inputs";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Applies style properties across a display selection.
 *
 * Styles **layer**: this appends a mark rather than merging into what is there,
 * and later marks win at render time. That is what makes removing the newer
 * style reveal the older one underneath instead of leaving unstyled text.
 *
 * The style is admitted before the content is read, so an invalid payload costs
 * no database round trip and reports the property that was wrong.
 */
export const applyStyle = async (
  scope: Scope,
  input: ApplyStyleInput
): Promise<ContentMutationResult> =>
  record("applyStyle", { contentId: input?.contentId, expectedVersion: input?.expectedVersion }, async () => {
    const properties = validateStyle(input.properties);
    const database = await projectDatabase(scope.projectId);
    const current = await currentContent(database, input.contentId, input.expectedVersion);
    const range = resolveDisplayRange(current, input.range);
    requireNonEmptyRange(current, range);
    const marks = addStyleMark(current.marks, range, properties);
    return commit(database, current, nextRevision(current, { marks }));
  });
