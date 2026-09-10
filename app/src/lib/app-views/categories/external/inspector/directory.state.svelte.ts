import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";

/** Mutable values owned by one mounted External directory inspector. */
export class ExternalDirectoryInspectorState {
  editing = $state<"rename" | "move">();
  draft = $state("");
  input = $state<HTMLInputElement | null>(null);
  base = $state<LibraryExternalDirectory>();
  pending = $state(false);
  actionError = $state<string>();
  mounted = true;
}
