import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { createRawContent } from "$rich-content/api/create/create-raw-content";
import { contentId } from "$rich-content/api/shared/ids";
import { record } from "$rich-content/api/shared/record";
import { insertContent, resultOf } from "$rich-content/api/shared/revisions";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Creates a content object, optionally from plain text.
 *
 * Returns identity and revision only. A caller that wants to render it asks
 * [`display`](../display/display.md) — which keeps raw atoms and marks off every
 * mutation path and means a caller that only needed the id does not pay for a
 * projection it would throw away.
 */
export const create = async (scope: Scope, initialText = ""): Promise<ContentMutationResult> =>
  // The length is recorded and the text is not. Rich Content holds authored
  // prose, and a log outlives the row it describes.
  record("create", { textLength: initialText?.length ?? 0 }, async () => {
    const database = await projectDatabase(scope.projectId);
    const content = createRawContent(contentId(), initialText ?? "");
    await insertContent(database, content);
    return resultOf(content);
  });
