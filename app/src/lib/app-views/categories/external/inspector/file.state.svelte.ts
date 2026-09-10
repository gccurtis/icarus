import { tick } from "svelte";

import type { ReuploadExternalFileResult } from "$capabilities/external-files/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import { directoryOf } from "$app-views/categories/external/procedures/detail-query";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";
import { inspectExternalFile } from "$app-views/categories/external/procedures/inspect-file";
import { relocateExternalFile } from "$app-views/categories/external/procedures/move-file";
import { removeExternalFile } from "$app-views/categories/external/procedures/remove-file";
import { renameExternalFile } from "$app-views/categories/external/procedures/rename-file";
import { updateExternalFileContext } from "$app-views/categories/external/procedures/update-context";

type ReuploadForm = { readonly pending: number; submit(): Promise<unknown> };

/** All mutable state for one mounted External file inspector. */
export class ExternalFileInspectorState {
  now = $state(Date.now());
  editingName = $state(false);
  editingPath = $state(false);
  nameDraft = $state("");
  pathDraft = $state("");
  contextDraft = $state("");
  nameInput = $state<HTMLInputElement | null>(null);
  pathInput = $state<HTMLInputElement | null>(null);
  base = $state<LibraryExternalFileDetail>();
  confirmingDelete = $state(false);
  pending = $state<"rename" | "move" | "delete" | "context">();
  actionError = $state<string>();
  actionNotice = $state<string>();
  handledReupload = $state<string>();
  activeId = $state<string>();
  mounted = true;

  dispose(): void {
    this.mounted = false;
  }

  reset(file: LibraryExternalFileDetail | undefined): void {
    this.activeId = file?.id;
    this.nameDraft = file?.name ?? "";
    this.pathDraft = file === undefined ? "" : directoryOf(file.relativePath);
    this.contextDraft = file?.semanticContext ?? "";
    this.base = undefined;
    this.editingName = false;
    this.editingPath = false;
    this.confirmingDelete = false;
    this.pending = undefined;
    this.actionError = undefined;
    this.actionNotice = undefined;
  }

  synchronize(file: LibraryExternalFileDetail | undefined): void {
    if (file === undefined || this.editingName || this.editingPath || this.pending === "context") return;
    this.nameDraft = file.name;
    this.pathDraft = directoryOf(file.relativePath);
    this.contextDraft = file.semanticContext ?? "";
  }

  acceptReupload(result: ReuploadExternalFileResult): void {
    const receipt = JSON.stringify(result);
    if (receipt === this.handledReupload) return;
    this.handledReupload = receipt;
    if (!result.accepted) {
      this.actionNotice = undefined;
      this.actionError = result.detail;
      return;
    }
    this.actionError = undefined;
    this.actionNotice = `Re-uploaded ${result.size.toLocaleString()} bytes as revision ${result.revision}.`;
  }

  busy(reuploadPending: number): boolean {
    return this.pending !== undefined || reuploadPending > 0;
  }

  async startName(file: LibraryExternalFileDetail | undefined, reuploadPending: number): Promise<void> {
    if (file === undefined || this.busy(reuploadPending)) return;
    this.base = file;
    this.nameDraft = file.name;
    this.editingPath = false;
    this.confirmingDelete = false;
    this.editingName = true;
    await tick();
    this.nameInput?.focus();
    this.nameInput?.select();
  }

  async startPath(file: LibraryExternalFileDetail | undefined, reuploadPending: number): Promise<void> {
    if (file === undefined || this.busy(reuploadPending)) return;
    this.base = file;
    this.pathDraft = directoryOf(file.relativePath);
    this.editingName = false;
    this.confirmingDelete = false;
    this.editingPath = true;
    await tick();
    this.pathInput?.focus();
    this.pathInput?.select();
  }

  cancelEdit(file: LibraryExternalFileDetail | undefined): void {
    this.nameDraft = file?.name ?? "";
    this.pathDraft = file === undefined ? "" : directoryOf(file.relativePath);
    this.base = undefined;
    this.editingName = false;
    this.editingPath = false;
  }

  askToDelete(file: LibraryExternalFileDetail | undefined): void {
    this.cancelEdit(file);
    this.confirmingDelete = true;
  }

  private stillInspecting(view: WorkspaceStateModel, tabId: string, id: string): boolean {
    return this.mounted && view.activeId === tabId &&
      view.selection?.kind === "external-file" && view.selection.id === id;
  }

  async commitName(view: WorkspaceStateModel, file: LibraryExternalFileDetail | undefined): Promise<void> {
    const held = this.base;
    const name = this.nameDraft.trim();
    if (held === undefined || file?.id !== held.id || this.pending !== undefined) return;
    if (name === held.name) return this.cancelEdit(file);
    if (name === "") return void (this.actionError = "A file name is required.");
    const tabId = view.activeId;
    this.pending = "rename";
    this.actionError = undefined;
    this.actionNotice = undefined;
    try {
      const result = await renameExternalFile(view, held, name);
      if (!this.stillInspecting(view, tabId, held.id)) return;
      if (!result.accepted) this.actionError = result.detail;
      else {
        this.editingName = false;
        this.base = undefined;
        this.actionNotice = "File renamed.";
      }
    } catch (error) {
      if (this.stillInspecting(view, tabId, held.id)) {
        this.actionError = error instanceof Error ? error.message : String(error);
      }
    } finally {
      this.pending = undefined;
    }
  }

  async commitPath(view: WorkspaceStateModel, file: LibraryExternalFileDetail | undefined): Promise<void> {
    const held = this.base;
    const destinationDirectory = this.pathDraft.trim();
    if (held === undefined || file?.id !== held.id || this.pending !== undefined) return;
    if (destinationDirectory === directoryOf(held.relativePath)) return this.cancelEdit(file);
    const tabId = view.activeId;
    this.pending = "move";
    this.actionError = undefined;
    this.actionNotice = undefined;
    try {
      const result = await relocateExternalFile(view, held, destinationDirectory);
      if (!this.stillInspecting(view, tabId, held.id)) return;
      if (!result.accepted) this.actionError = result.detail;
      else {
        this.editingPath = false;
        this.base = undefined;
        this.actionNotice = "File moved.";
      }
    } catch (error) {
      if (this.stillInspecting(view, tabId, held.id)) {
        this.actionError = error instanceof Error ? error.message : String(error);
      }
    } finally {
      this.pending = undefined;
    }
  }

  editKeydown(event: KeyboardEvent, commit: () => Promise<void>, file: LibraryExternalFileDetail | undefined): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.cancelEdit(file);
    } else if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
  }

  async saveContext(view: WorkspaceStateModel, file: LibraryExternalFileDetail | undefined): Promise<void> {
    if (file === undefined || this.pending !== undefined) return;
    this.pending = "context";
    this.actionError = undefined;
    this.actionNotice = undefined;
    try {
      const result = await updateExternalFileContext(view, file, this.contextDraft);
      if (!result.accepted) this.actionError = result.detail;
      else this.actionNotice = result.semantic === "queued"
        ? "Dataset context saved and semantic processing queued."
        : "Dataset context saved.";
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : String(error);
    } finally {
      this.pending = undefined;
    }
  }

  async remove(
    view: WorkspaceStateModel,
    file: LibraryExternalFileDetail | undefined,
    nextId: string | undefined
  ): Promise<void> {
    if (file === undefined || this.pending !== undefined) return;
    this.pending = "delete";
    this.actionError = undefined;
    try {
      const result = await removeExternalFile(view, file);
      if (!result.accepted) {
        this.actionError = result.detail;
        this.confirmingDelete = false;
        return;
      }
      if (nextId === undefined) view.showContent("external.library");
      else inspectExternalFile(view, nextId);
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : String(error);
    } finally {
      this.pending = undefined;
    }
  }

  async chooseReplacement(
    input: HTMLInputElement,
    file: LibraryExternalFileDetail | undefined,
    reupload: ReuploadForm
  ): Promise<void> {
    if ((input.files?.length ?? 0) !== 1 || file === undefined) return;
    this.actionError = undefined;
    this.actionNotice = undefined;
    await tick();
    await reupload.submit();
    input.value = "";
  }
}
