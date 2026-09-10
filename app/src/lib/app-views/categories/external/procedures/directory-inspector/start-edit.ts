import { tick } from "svelte";

import type { ExternalDirectoryInspectorState } from "$app-views/categories/external/inspector/directory.state.svelte";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";

export const startDirectoryEdit = async (
  state: ExternalDirectoryInspectorState,
  kind: "rename" | "move",
  directory: LibraryExternalDirectory | undefined
): Promise<void> => {
  if (directory === undefined || state.pending) return;
  state.base = directory;
  state.editing = kind;
  state.draft = kind === "rename" ? directory.name : directory.relativePath;
  await tick();
  state.input?.focus();
  state.input?.select();
};
