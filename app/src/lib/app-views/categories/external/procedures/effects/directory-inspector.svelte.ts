import { onDestroy } from "svelte";

import type { ExternalDirectoryInspectorState } from "$app-views/categories/external/inspector/directory.state.svelte";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";
import { disposeDirectoryInspector } from "$app-views/categories/external/procedures/directory-inspector/dispose";
import { synchronizeDirectoryInspector } from "$app-views/categories/external/procedures/directory-inspector/synchronize";

/** Synchronizes one mounted virtual-directory inspector with workspace selection. */
export const keepExternalDirectoryInspectorCurrent = (
  state: ExternalDirectoryInspectorState,
  directory: () => LibraryExternalDirectory | undefined
): void => {
  onDestroy(() => disposeDirectoryInspector(state));
  $effect(() => synchronizeDirectoryInspector(state, directory()));
};
