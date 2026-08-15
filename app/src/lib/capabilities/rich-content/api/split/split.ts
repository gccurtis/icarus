import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { resolveDisplayPosition } from "$rich-content/api/shared/display-range";
import { contentId } from "$rich-content/api/shared/ids";
import { record } from "$rich-content/api/shared/record";
import {
  currentContent,
  replaceOneWithTwo,
  resultOf,
  throwCommitConflict
} from "$rich-content/api/shared/revisions";
import { splitRawContent } from "$rich-content/api/split/split-raw-content";
import type { SplitContentInput } from "$rich-content/types/inputs";
import type { SplitContentResult } from "$rich-content/types/results";

/**
 * Divides one content object into two, at a display position.
 *
 * **The source is destroyed.** This is not a copy: the original id stops
 * existing and two new version-1 objects take its place, which is why the result
 * reports both.
 *
 * The whole replacement is **one transaction**. Both intermediate states are
 * wrong — the original gone with no replacements, or two replacements alongside
 * an original that still exists — so a reader must see one or the other and
 * never a moment between. A concurrent write to the source rolls the whole thing
 * back and reports `stale-version`.
 */
export const split = async (
  scope: Scope,
  input: SplitContentInput
): Promise<SplitContentResult> =>
  record("split", { contentId: input?.contentId, expectedVersion: input?.expectedVersion }, async () => {
    const database = await projectDatabase(scope.projectId);
    const current = await currentContent(database, input.contentId, input.expectedVersion);
    const at = resolveDisplayPosition(current, input.at);
    const parts = splitRawContent(current, at, contentId(), contentId());

    const replaced = await replaceOneWithTwo(
      database,
      { id: current.id, expectedVersion: current.version },
      parts.left,
      parts.right
    );
    if (!replaced) throwCommitConflict(current.id);

    return { left: resultOf(parts.left), right: resultOf(parts.right) };
  });
