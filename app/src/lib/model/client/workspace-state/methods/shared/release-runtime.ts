import type { Target } from "$representation/data/types/workspace/tab";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

/** Release the runtime whose owning resource tab has left the workspace. */
export const releaseForTarget = (state: WorkspaceStateData, target: Target): void => {
  if (target.resourceId === undefined) return;

  switch (target.category) {
    case "document-editor": {
      const documentRuntimes = state.documents;
      documentRuntimes?.release(target.resourceId);
      return;
    }
    case "presentation-editor": {
      const presentationRuntimes = state.presentations;
      presentationRuntimes?.release(target.resourceId);
      return;
    }
    case "spreadsheet-editor": {
      const spreadsheetRuntimes = state.sheets;
      spreadsheetRuntimes?.release(target.resourceId);
      return;
    }
    default:
      return;
  }
};
