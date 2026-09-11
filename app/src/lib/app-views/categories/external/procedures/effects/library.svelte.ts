import { onMount } from "svelte";

import { externalDirectoryIn } from "$representation/data/behavior/external/file";
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
  let observedSelection = view.selection;
  let observedFocus: string | undefined;

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
    const selection = view.selection;
    const selectionChanged = selection !== observedSelection;
    const focusChanged = focus !== observedFocus;
    observedSelection = selection;
    observedFocus = focus;
    if (!input.ready() || focus === undefined) return;
    const file = input.files().find((row) => row.id === focus);
    if (file === undefined) return;
    if (
      state.mode === "directory" &&
      selectionChanged &&
      selection?.kind === "external-file" &&
      selection.id === focus
    ) {
      setLibraryDirectory(state, externalDirectoryIn(file.relativePath));
    }
    if (selection?.kind === "external-directory") return;
    if (selection?.kind === "external-file" && selection.id === focus) return;
    if (focusChanged) inspectExternalFile(view, focus);
  });
};
