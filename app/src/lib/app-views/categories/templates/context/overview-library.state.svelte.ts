import { createTemplate } from "$app-views/categories/templates/procedures/create-template";
import { inspectTemplate } from "$app-views/categories/templates/procedures/inspect-template";
import { nextTemplateName } from "$app-views/categories/templates/procedures/library-summary";
import type {
  LibraryTemplate,
  TemplateTarget
} from "$app-views/categories/templates/procedures/library-types";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/** Component-lifetime state and the one asynchronous creation command for Overview. */
export class OverviewLibraryState {
  creating = $state<TemplateTarget>();
  nameDraft = $state("");
  actionError = $state<string>();

  private live = true;

  constructor(private readonly view: WorkspaceStateModel) {}

  dispose(): void {
    this.live = false;
  }

  create(target: TemplateTarget, templates: readonly LibraryTemplate[]): void {
    if (this.creating !== undefined) return;
    const originTabId = this.view.activeId;
    const originSelectionId = this.view.selection?.id;
    const name = this.nameDraft.trim() || nextTemplateName(target, templates);
    this.creating = target;
    this.actionError = undefined;

    void createTemplate(this.view, target, name)
      .then((result) => {
        if (
          !this.live ||
          this.view.activeId !== originTabId ||
          this.view.selection?.id !== originSelectionId
        ) return;
        if (!result.accepted) {
          this.actionError = result.detail;
          return;
        }
        this.nameDraft = "";
        inspectTemplate(this.view, result.templateId);
      })
      .catch((error: unknown) => {
        if (this.live) this.actionError = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        if (this.live) this.creating = undefined;
      });
  }
}
