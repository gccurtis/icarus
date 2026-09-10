import { onDestroy, onMount } from "svelte";

import type { ReuploadExternalFileResult } from "$capabilities/external-files/index.remote";
import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

type Inputs = {
  readonly file: () => LibraryExternalFileDetail | undefined;
  readonly reuploadResult: () => ReuploadExternalFileResult | undefined;
};

/** Registers the file inspector's clock, disposal, and remote-result synchronization. */
export const keepExternalFileInspectorCurrent = (
  state: ExternalFileInspectorState,
  input: Inputs
): void => {
  onDestroy(() => state.dispose());
  onMount(() => {
    const timer = setInterval(() => (state.now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  $effect(() => {
    const file = input.file();
    if (file?.id === state.activeId) return;
    state.reset(file);
  });
  $effect(() => state.synchronize(input.file()));
  $effect(() => {
    const result = input.reuploadResult();
    if (result !== undefined) state.acceptReupload(result);
  });
};
