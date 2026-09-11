import {
  readResourceTemplate,
  readTemplate,
  readTemplateLibrary,
  updateTemplate
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ChosenSlot } from "$app-views/categories/document-editor/procedures/template-slots";

export const updateSlots = (
  view: WorkspaceStateModel,
  template: { readonly id: string; readonly revision: number },
  slots: readonly ChosenSlot[],
  resourceId?: string
) =>
  view.singleFlight(
    ["template", view.project, template.id, "slots", template.revision, JSON.stringify(slots)],
    () =>
      updateTemplate({
        templateId: template.id,
        baseRevision: template.revision,
        patch: { slots }
      }).updates(
        readTemplateLibrary,
        readTemplate({ templateId: template.id }),
        ...(resourceId === undefined ? [] : [readResourceTemplate({ resourceId })])
      )
  );
