import {
  createTemplateFromResource,
  readTemplateLibrary
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const saveAsTemplate = (
  view: WorkspaceStateModel,
  resourceId: string,
  name: string,
  slideId?: string
) =>
  view.singleFlight(
    ["template", view.project, "from-resource", resourceId, slideId ?? null, name.trim()],
    () =>
      createTemplateFromResource({
        target: "presentation",
        resourceId,
        name: name.trim(),
        ...(slideId === undefined ? {} : { slideId })
      }).updates(readTemplateLibrary)
  );
