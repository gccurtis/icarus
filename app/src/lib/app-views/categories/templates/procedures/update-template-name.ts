import {
  readTemplate,
  readTemplateLibrary,
  updateTemplate
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryTemplateDetail } from "$app-views/categories/templates/procedures/library-types";

export const updateTemplateName = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  name: string
) => {
  const storedName = name.trim();
  return view.singleFlight(
    ["template", view.project, row.id, "update", row.revision, "name", storedName],
    () =>
      updateTemplate({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { name: storedName }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
};
