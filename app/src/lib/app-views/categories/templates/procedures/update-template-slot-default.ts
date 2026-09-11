import {
  readTemplate,
  readTemplateLibrary,
  updateTemplate
} from "$capabilities/templates/index.remote";
import type { ScopeDraft } from "$representation/data/behavior/core/scope-draft";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryTemplateDetail } from "$app-views/categories/templates/procedures/library-types";

export const updateTemplateSlotDefault = (
  view: WorkspaceStateModel,
  row: LibraryTemplateDetail,
  slotName: string,
  rule: ScopeDraft
) => {
  const slots = row.slots.map(({ id: _id, ...slot }) =>
    slot.name === slotName ? { ...slot, default: rule } : slot
  );
  return view.singleFlight(
    ["template", view.project, row.id, "update", row.revision, "slot-default", slotName, JSON.stringify(rule)],
    () =>
      updateTemplate({
        templateId: row.id,
        baseRevision: row.revision,
        patch: { slots }
      }).updates(readTemplateLibrary, readTemplate({ templateId: row.id }))
  );
};
