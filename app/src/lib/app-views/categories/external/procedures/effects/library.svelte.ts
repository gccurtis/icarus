import { onMount } from "svelte";

import type { UploadExternalFilesResult } from "$capabilities/external-files/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import type {
  LibraryExternalDirectory,
  LibraryExternalFile
} from "$app-views/categories/external/procedures/library-query";
import { inspectExternalFile } from "$app-views/categories/external/procedures/inspect-file";

type Inputs = {
  readonly fileResult: () => UploadExternalFilesResult | undefined;
  readonly folderResult: () => UploadExternalFilesResult | undefined;
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
    const result = input.fileResult();
    if (result === undefined || !state.acceptUpload("files", result)) return;
    const first = result.outcomes.find((outcome) => outcome.status !== "rejected");
    if (first !== undefined) inspectExternalFile(view, first.externalFileId);
  });

  $effect(() => {
    const result = input.folderResult();
    if (result === undefined || !state.acceptUpload("folder", result)) return;
    const first = result.outcomes.find((outcome) => outcome.status !== "rejected");
    if (first !== undefined) inspectExternalFile(view, first.externalFileId);
  });

  $effect(() => {
    if (!input.ready() || state.currentDirectory === "") return;
    if (!input.directories().some((row) => row.relativePath === state.currentDirectory)) {
      state.currentDirectory = "";
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
