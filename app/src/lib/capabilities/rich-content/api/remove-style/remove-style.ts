import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import {
  requireNonEmptyRange,
  resolveDisplayRange
} from "$rich-content/api/shared/display-range";
import { record } from "$rich-content/api/shared/record";
import { commit, currentContent, nextRevision } from "$rich-content/api/shared/revisions";
import { removeStyleProperties } from "$rich-content/api/shared/style";
import type { RemoveStyleInput } from "$rich-content/types/inputs";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Removes named style properties across a display selection.
 *
 * Named properties rather than "clear all", because a range usually carries
 * styles from more than one decision and clearing everything would discard the
 * ones the caller did not ask about.
 *
 * Each affected mark is split into the part before the selection, the part
 * inside it with those properties dropped, and the part after — so a style
 * extending past the selection survives outside it.
 */
export const removeStyle = async (
  scope: Scope,
  input: RemoveStyleInput
): Promise<ContentMutationResult> =>
  record("removeStyle", { contentId: input?.contentId, expectedVersion: input?.expectedVersion }, async () => {
    const database = await projectDatabase(scope.projectId);
    const current = await currentContent(database, input.contentId, input.expectedVersion);
    const range = resolveDisplayRange(current, input.range);
    requireNonEmptyRange(current, range);
    const marks = removeStyleProperties(current, range, input.properties);
    return commit(database, current, nextRevision(current, { marks }));
  });
