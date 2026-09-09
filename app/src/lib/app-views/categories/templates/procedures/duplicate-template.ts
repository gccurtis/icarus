import {
  duplicateTemplate as duplicateTemplateRemote,
  readTemplateLibrary
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryTemplateDetail } from "$app-views/categories/templates/procedures/library-types";

export const duplicateTemplate = (view: WorkspaceStateModel, row: LibraryTemplateDetail) =>
  view.singleFlight(["template", view.project, row.id, "duplicate"], () =>
    duplicateTemplateRemote({ templateId: row.id }).updates(readTemplateLibrary)
  );
