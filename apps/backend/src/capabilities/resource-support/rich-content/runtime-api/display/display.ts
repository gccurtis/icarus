import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { DisplayContent } from "#rich-content/types/display-content.js";
import type { RichContentId } from "#rich-content/types/ids.js";
import { renderDisplayContent } from "#rich-content/runtime-api/shared/render-display.js";
import { requiredContent } from "#rich-content/runtime-api/shared/revisions.js";

export const display = async (
  store: RichContentStore,
  id: RichContentId
): Promise<DisplayContent> =>
  renderDisplayContent(await requiredContent(store, id));
