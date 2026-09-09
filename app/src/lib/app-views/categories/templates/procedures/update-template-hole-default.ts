import {
  readTemplate,
  readTemplateLibrary,
  updateTemplate
} from "$capabilities/templates/index.remote";
import type { ScopeDraft } from "$representation/data/behavior/core/scope-draft";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryTemplateDetail } from "$app-views/categories/templates/procedures/library-types";

export const updateTemplateHoleDefault = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  holeName: string,
  rule: ScopeDraft
) => {
  const holes = row.holes.map(({ id: _id, ...hole }) =>
    hole.name === holeName ? { ...hole, default: rule } : hole
  );
  return view.singleFlight(
    ["template", view.project, row.id, "update", row.revision, "hole-default", holeName, JSON.stringify(rule)],
    () =>
      updateTemplate({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { holes }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
};
