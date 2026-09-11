import {
  readTemplate,
  readTemplateLibrary,
  updateTemplate
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryTemplateDetail } from "$app-views/categories/templates/procedures/library-types";

export const updateTemplateSlotDescription = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  slotName: string,
  description: string
) => {
  const storedDescription = description.trim() || null;
  return view.singleFlight(
    [
      "template",
      view.project,
      row.id,
      "update",
      row.revision,
      "slot-description",
      slotName,
      storedDescription
    ],
    () =>
      updateTemplate({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { slotDescription: { name: slotName, description: storedDescription } }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
};
