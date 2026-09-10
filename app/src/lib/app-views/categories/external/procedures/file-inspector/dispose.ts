import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";

export const disposeFileInspector = (state: ExternalFileInspectorState): void => {
  state.mounted = false;
};
