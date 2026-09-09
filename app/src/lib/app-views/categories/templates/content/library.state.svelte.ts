import {
  editTemplate,
  inspectTemplate,
  type LibraryTemplate
} from "$app-views/categories/templates/procedures/library.svelte";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/** Owns the asynchronous transition from a library row into its staged editor. */
export class LibraryEditState {
  opening = $state<string | undefined>(undefined);
  openError = $state<string | undefined>(undefined);

  edit(view: WorkspaceStateModel, row: LibraryTemplate): void {
    if (this.opening !== undefined) return;
    inspectTemplate(view, row.id);
    if (row.makes === "Spreadsheet") {
      this.openError = "Spreadsheet templates open for editing once the spreadsheet editor lands.";
      return;
    }
    this.opening = row.id;
    this.openError = undefined;
    void this.perform(view, row);
  }

  private async perform(view: WorkspaceStateModel, row: LibraryTemplate): Promise<void> {
    try {
      const result = await editTemplate(view, row);
      if (!result.accepted) this.openError = result.detail;
    } catch (error) {
      this.openError = error instanceof Error ? error.message : String(error);
    } finally {
      this.opening = undefined;
    }
  }
}
