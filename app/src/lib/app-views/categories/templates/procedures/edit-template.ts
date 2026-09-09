import {
  openTemplateStage,
  readTemplate,
  readTemplateLibrary
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import { EDITOR_CATEGORY, type LibraryTemplate } from "$app-views/categories/templates/procedures/library-types";

const EDITOR_TEMPLATES_PANEL = {
  document: "document-editor.templates",
  slides: "slide-deck-editor.templates"
} as const;

export const editTemplate = async (view: WorkspaceStateModel, row: LibraryTemplate) => {
  const result = await view.singleFlight(["template", view.project, row.id, "stage"], () =>
    openTemplateStage({ templateId: row.id }).updates(
      readTemplateLibrary,
      readTemplate({ templateId: row.id }),
      view.readStore(row.makes === "Document" ? "documents" : "slideDecks")
    )
  );
  if (result.accepted) {
    view.open({
      category: EDITOR_CATEGORY[result.target],
      resourceId: result.resourceId,
      context: EDITOR_TEMPLATES_PANEL[result.target]
    });
  }
  return result;
};
