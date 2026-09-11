import {
  readResourceTemplate,
  readTemplate,
  readTemplateLibrary,
  updateTemplate
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ChosenHole } from "$app-views/categories/presentation-editor/procedures/template-holes";

export const updateHoles = (
  view: WorkspaceStateModel,
  template: { readonly id: string; readonly revision: number },
  holes: readonly ChosenHole[],
  resourceId?: string
) =>
  view.singleFlight(
    ["template", view.project, template.id, "holes", template.revision, JSON.stringify(holes)],
    () =>
      updateTemplate({
        templateId: template.id,
        baseRevision: template.revision,
        patch: { holes }
      }).updates(
        readTemplateLibrary,
        readTemplate({ templateId: template.id }),
        ...(resourceId === undefined ? [] : [readResourceTemplate({ resourceId })])
      )
  );
