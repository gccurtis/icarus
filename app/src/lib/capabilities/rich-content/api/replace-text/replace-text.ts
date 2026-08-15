import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { replaceAtomText } from "$rich-content/api/replace-text/replace-atom-text";
import { record } from "$rich-content/api/shared/record";
import { commit, currentContent, nextRevision } from "$rich-content/api/shared/revisions";
import type { ReplaceTextInput } from "$rich-content/types/inputs";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Replaces a range of text within one atom.
 *
 * The only function taking an **atom** range rather than a display range: text
 * editing is inherently per-atom, and a display segment already names the atom
 * and offsets it came from. Everything else a caller sends is display-shaped.
 */
export const replaceText = async (
  scope: Scope,
  input: ReplaceTextInput
): Promise<ContentMutationResult> =>
  // The replacement length is recorded; the text itself never is.
  record(
    "replaceText",
    { contentId: input?.contentId, atomId: input?.atomId, textLength: input?.text?.length },
    async () => {
      const database = await projectDatabase(scope.projectId);
      const current = await currentContent(database, input.contentId, input.expectedVersion);
      return commit(database, current, nextRevision(current, replaceAtomText(current, input)));
    }
  );
