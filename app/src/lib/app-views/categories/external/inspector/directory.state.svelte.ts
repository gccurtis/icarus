import { tick } from "svelte";

import type { WorkspaceStateModel } from "$model/client/workspace-state";
import { inspectExternalDirectory } from "$app-views/categories/external/procedures/inspect-directory";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";
import { relocateExternalDirectory } from "$app-views/categories/external/procedures/move-directory";

/** Mutable command state owned by one mounted External directory inspector. */
export class ExternalDirectoryInspectorState {
  editing = $state<"rename" | "move">();
  draft = $state("");
  input = $state<HTMLInputElement | null>(null);
  base = $state<LibraryExternalDirectory>();
  pending = $state(false);
  actionError = $state<string>();
  mounted = true;

  dispose(): void {
    this.mounted = false;
  }

  synchronize(directory: LibraryExternalDirectory | undefined): void {
    if (this.base?.relativePath === directory?.relativePath) return;
    this.base = undefined;
    this.editing = undefined;
    this.draft = directory?.relativePath ?? "";
    this.actionError = undefined;
  }

  async start(kind: "rename" | "move", directory: LibraryExternalDirectory | undefined): Promise<void> {
    if (directory === undefined || this.pending) return;
    this.base = directory;
    this.editing = kind;
    this.draft = kind === "rename" ? directory.name : directory.relativePath;
    await tick();
    this.input?.focus();
    this.input?.select();
  }

  cancel(directory: LibraryExternalDirectory | undefined): void {
    this.base = undefined;
    this.editing = undefined;
    this.draft = directory?.relativePath ?? "";
  }

  private destinationFor(held: LibraryExternalDirectory): string {
    const value = this.draft.trim();
    if (this.editing === "move") return value;
    return held.parentPath === "" || held.parentPath === null ? value : `${held.parentPath}/${value}`;
  }

  async commit(
    view: WorkspaceStateModel,
    directory: LibraryExternalDirectory | undefined
  ): Promise<void> {
    const held = this.base;
    if (held === undefined || this.editing === undefined || this.pending) return;
    const destinationDirectory = this.destinationFor(held);
    if (destinationDirectory === "") {
      this.actionError = "A directory name or path is required.";
      return;
    }
    if (destinationDirectory === held.relativePath) return this.cancel(directory);
    this.pending = true;
    this.actionError = undefined;
    try {
      const result = await relocateExternalDirectory(view, held, destinationDirectory);
      if (!this.mounted) return;
      if (!result.accepted) this.actionError = result.detail;
      else {
        this.cancel(directory);
        inspectExternalDirectory(view, result.destinationDirectory);
      }
    } catch (error) {
      if (this.mounted) this.actionError = error instanceof Error ? error.message : String(error);
    } finally {
      this.pending = false;
    }
  }

  keydown(
    event: KeyboardEvent,
    view: WorkspaceStateModel,
    directory: LibraryExternalDirectory | undefined
  ): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.cancel(directory);
    } else if (event.key === "Enter") {
      event.preventDefault();
      void this.commit(view, directory);
    }
  }
}
