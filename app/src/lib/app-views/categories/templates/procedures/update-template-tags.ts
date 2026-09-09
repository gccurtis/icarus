import {
  readTemplate,
  readTemplateLibrary,
  updateTemplate
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryTemplateDetail } from "$app-views/categories/templates/procedures/library-types";

export const updateTemplateTags = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  tags: readonly string[]
) =>
  view.singleFlight(
    ["template", view.project, row.id, "update", row.revision, "tags", ...tags],
    () =>
      updateTemplate({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { tags }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
