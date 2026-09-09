import {
  openTemplateStage,
  readTemplate,
  readTemplateLibrary
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const openStage = (view: WorkspaceStateModel, templateId: string) =>
  view.singleFlight(["template", view.project, templateId, "stage"], () =>
    openTemplateStage({ templateId }).updates(
      readTemplateLibrary,
      readTemplate({ templateId }),
      view.readStore("documents")
    )
  );
