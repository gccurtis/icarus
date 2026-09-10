import { onMount } from "svelte";

import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import type {
  LibraryExternalDirectory,
  LibraryExternalFile
} from "$app-views/categories/external/procedures/library-query";
import { inspectExternalFile } from "$app-views/categories/external/procedures/inspect-file";
import { setLibraryDirectory } from "$app-views/categories/external/procedures/set-library-directory";

type Inputs = {
  readonly ready: () => boolean;
  readonly files: () => readonly LibraryExternalFile[];
  readonly directories: () => readonly LibraryExternalDirectory[];
};

/** Registers every synchronization owned by one mounted External library. */
export const keepExternalLibraryCurrent = (
  state: ExternalLibraryState,
  view: WorkspaceStateModel,
  input: Inputs
): void => {
  onMount(() => {
    const timer = setInterval(() => (state.now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });

  $effect(() => {
    if (!input.ready() || state.currentDirectory === "") return;
    if (!input.directories().some((row) => row.relativePath === state.currentDirectory)) {
      setLibraryDirectory(state, "");
    }
  });

  $effect(() => {
    const focus = view.active.focus;
    if (!input.ready() || focus === undefined) return;
    if (view.selection?.kind === "external-directory") return;
    if (view.selection?.kind === "external-file" && view.selection.id === focus) return;
    if (input.files().some((row) => row.id === focus)) inspectExternalFile(view, focus);
  });
};
