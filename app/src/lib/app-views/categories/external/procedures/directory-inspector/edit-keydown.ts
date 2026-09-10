import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalDirectoryInspectorState } from "$app-views/categories/external/inspector/directory.state.svelte";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";
import { cancelDirectoryEdit } from "$app-views/categories/external/procedures/directory-inspector/cancel-edit";
import { commitDirectoryEdit } from "$app-views/categories/external/procedures/directory-inspector/commit";

export const directoryEditKeydown = (
  state: ExternalDirectoryInspectorState,
  event: KeyboardEvent,
  view: WorkspaceStateModel,
  directory: LibraryExternalDirectory | undefined
): void => {
  if (event.key === "Escape") {
    event.preventDefault();
    cancelDirectoryEdit(state, directory);
  } else if (event.key === "Enter") {
    event.preventDefault();
    void commitDirectoryEdit(state, view, directory);
  }
};
