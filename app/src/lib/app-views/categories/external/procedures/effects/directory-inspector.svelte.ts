import { onDestroy } from "svelte";

import type { ExternalDirectoryInspectorState } from "$app-views/categories/external/inspector/directory.state.svelte";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";

/** Synchronizes one mounted virtual-directory inspector with workspace selection. */
export const keepExternalDirectoryInspectorCurrent = (
  state: ExternalDirectoryInspectorState,
  directory: () => LibraryExternalDirectory | undefined
): void => {
  onDestroy(() => state.dispose());
  $effect(() => state.synchronize(directory()));
};
