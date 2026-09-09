import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const inspectTemplate = (view: WorkspaceStateModel, templateId: string): void => {
  view.open({ category: "templates", focus: templateId });
  view.inspect("templates.template", { kind: "template", id: templateId });
};
