import { createChat } from "$app-views/categories/project-overview/procedures/create-chat";
import { createProjectResource } from "$app-views/categories/project-overview/procedures/resources";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/** What the board holds while one of its Create buttons is working. */
export type Creating = {
  mounted: boolean;
  making: "document" | "slides" | "spreadsheet" | "research" | undefined;
  failure: string | undefined;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "That did not start";

/**
 * Makes a resource and opens it, unless the person moved on while it was made.
 *
 * The tab and the selection are read before the write and compared after: a
 * board left open in another tab must not yank that tab onto a document
 * somebody started making a minute ago and stopped waiting for.
 */
export const makeResource = async (
  view: WorkspaceStateModel,
  state: Creating,
  key: "document" | "slides" | "spreadsheet" | "research"
): Promise<void> => {
  if (state.making !== undefined) return;
  const originTabId = view.activeId;
  const originSelection = view.selection;
  state.making = key;
  state.failure = undefined;
  try {
    if (key === "research") {
      const threadId = await createChat(view);
      if (state.mounted) {
        view.open({ category: "research", content: "research.thread", resourceId: threadId });
      }
      return;
    }
    const { resourceId } = await createProjectResource(view, { target: key });
    const selectionUnchanged =
      view.selection?.kind === originSelection?.kind &&
      view.selection?.id === originSelection?.id &&
      view.selection?.at === originSelection?.at;
    if (state.mounted && view.activeId === originTabId && selectionUnchanged) {
      view.open({
        category:
          key === "document"
            ? "document-editor"
            : key === "slides"
              ? "slide-deck-editor"
              : "spreadsheet-editor",
        resourceId
      });
    }
  } catch (error) {
    if (state.mounted) state.failure = messageOf(error);
  } finally {
    if (state.mounted) state.making = undefined;
  }
};
