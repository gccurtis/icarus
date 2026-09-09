import {
  createTemplateFromResource,
  readTemplateLibrary
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const saveAsTemplate = (view: WorkspaceStateModel, resourceId: string, name: string) =>
  view.singleFlight(["template", view.project, "from-resource", resourceId, name.trim()], () =>
    createTemplateFromResource({ target: "document", resourceId, name: name.trim() }).updates(
      readTemplateLibrary
    )
  );
