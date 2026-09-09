import {
  readTemplate,
  readTemplateLibrary,
  removeTemplate as removeTemplateRemote
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryTemplateDetail } from "$app-views/categories/templates/procedures/library-types";

export const removeTemplate = (view: WorkspaceStateModel, row: LibraryTemplateDetail) =>
  view.singleFlight(["template", view.project, row.id, "remove", row.revision], () =>
    removeTemplateRemote({ templateId: row.id, baseRevision: row.revision }).updates(
      readTemplateLibrary,
      readTemplate({ templateId: row.id })
    )
  );
