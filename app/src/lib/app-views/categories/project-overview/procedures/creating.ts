import { createProjectResource } from "$app-views/categories/project-overview/procedures/resources";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export type Creation = {
  readonly view: WorkspaceStateModel;
  readonly target: "document" | "slides" | "spreadsheet";
  readonly live: () => boolean;
  readonly refused: (message: string | undefined) => void;
  readonly ended: () => void;
};

/**
 * A new resource, and the tab that opens on it if the reader is still waiting.
 *
 * The made resource opens only when nothing moved while the server answered —
 * the same tab, the same selection, the same screen. A reader who navigated on
 * has said where they want to be, and the answer to a request they left behind
 * should not take them back.
 */
export const createsResource = async (asked: Creation): Promise<void> => {
  const { view, target } = asked;
  const originTabId = view.activeId;
  const originSelection = view.selection;
  asked.refused(undefined);

  try {
    const { resourceId } = await createProjectResource(view, { target });
    const held =
      view.selection?.kind === originSelection?.kind &&
      view.selection?.id === originSelection?.id &&
      view.selection?.at === originSelection?.at;

    if (asked.live() && view.activeId === originTabId && held) {
      view.open({
        category:
          target === "document"
            ? "document-editor"
            : target === "slides"
              ? "slide-deck-editor"
              : "spreadsheet-editor",
        resourceId
      });
    }
  } catch (error) {
    asked.refused(error instanceof Error ? error.message : String(error));
  } finally {
    asked.ended();
  }
};
