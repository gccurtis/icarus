import type { Target } from "$representation/data/types/workspace/tab";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

/** Acquire the runtime whose lifetime is represented by a resource tab. */
export const acquireForTarget = (state: WorkspaceStateData, target: Target): void => {
  if (target.resourceId === undefined) return;

  switch (target.category) {
    case "document-editor": {
      const documentRuntimes = state.documents;
      documentRuntimes?.attach(target.resourceId);
      return;
    }
    case "slide-deck-editor": {
      const slideDeckRuntimes = state.decks;
      slideDeckRuntimes?.attach(target.resourceId);
      return;
    }
    case "spreadsheet-editor": {
      const spreadsheetRuntimes = state.sheets;
      spreadsheetRuntimes?.attach(target.resourceId);
      return;
    }
    default:
      return;
  }
};
