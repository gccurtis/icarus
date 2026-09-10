import type { ExternalDirectoryInspectorState } from "$app-views/categories/external/inspector/directory.state.svelte";

export const disposeDirectoryInspector = (state: ExternalDirectoryInspectorState): void => {
  state.mounted = false;
};
