import {
  editTemplate,
  type LibraryTemplate
} from "$app-views/categories/templates/procedures/library.svelte";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/** Owns the one asynchronous handoff from the template editor route. */
export class EditorOpenState {
  opening = $state<string | undefined>(undefined);
  refused = $state<string | undefined>(undefined);
  private live = true;

  dispose(): void {
    this.live = false;
  }

  open(view: WorkspaceStateModel, row: LibraryTemplate): void {
    if (this.opening !== undefined || this.refused !== undefined) return;
    this.opening = row.id;
    void this.perform(view, row);
  }

  private async perform(view: WorkspaceStateModel, row: LibraryTemplate): Promise<void> {
    try {
      const result = await editTemplate(view, row);
      if (!this.live) return;
      if (result.accepted) view.showContent("templates.library", row.id);
      else this.refused = result.detail;
    } catch (error) {
      if (this.live) this.refused = error instanceof Error ? error.message : String(error);
    } finally {
      if (this.live) this.opening = undefined;
    }
  }
}
