import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";

export const fileInspectorIsBusy = (
  state: ExternalFileInspectorState,
  reuploadPending: number
): boolean => state.pending !== undefined || reuploadPending > 0;
