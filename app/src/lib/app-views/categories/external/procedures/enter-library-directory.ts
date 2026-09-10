import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import { inspectExternalDirectory } from "$app-views/categories/external/procedures/inspect-directory";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";
import { setLibraryDirectory } from "$app-views/categories/external/procedures/set-library-directory";

export const enterLibraryDirectory = (
  state: ExternalLibraryState,
  view: WorkspaceStateModel,
  directory: LibraryExternalDirectory
): void => {
  setLibraryDirectory(state, directory.relativePath);
  inspectExternalDirectory(view, directory.relativePath);
};
