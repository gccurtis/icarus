import { projectDatabase } from "$model/server/index.server";
import type { Scope } from "$model/server/scope.server";
import { record } from "$rich-content/api/shared/record";
import { renderDisplayContent } from "$rich-content/api/shared/render-display";
import { requiredContent } from "$rich-content/api/shared/revisions";
import type { DisplayContent } from "$rich-content/types/display-content";
import type { RichContentId } from "$rich-content/types/ids";

/**
 * The public projection of one content object.
 *
 * **The only function that returns content**, and the only way a caller obtains
 * the segment handles every mutation needs. Those handles embed the version they
 * were rendered at, so a selection taken here and used after someone else's
 * write is refused rather than applied somewhere else.
 *
 * The projection is derived on every read and never stored, which is what lets
 * the private representation keep overlapping marks while a consumer receives
 * flat segments it can render directly.
 */
export const display = async (scope: Scope, id: RichContentId): Promise<DisplayContent> =>
  record("display", { contentId: id }, async () => {
    const database = await projectDatabase(scope.projectId);
    return renderDisplayContent(await requiredContent(database, id));
  });
