import {
  createTemplate as createTemplateRemote,
  readTemplateLibrary,
  type TemplateTarget as StoredTemplateTarget
} from "$capabilities/templates/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { TemplateTarget } from "$app-views/categories/templates/procedures/library-types";

const TARGET_VALUE: Record<TemplateTarget, StoredTemplateTarget> = {
  Document: "document",
  "Slide deck": "slides",
  Spreadsheet: "spreadsheet"
};

export const createTemplate = (
  view: WorkspaceStateModel,
  target: TemplateTarget,
  name: string
) => {
  const storedTarget = TARGET_VALUE[target];
  const storedName = name.trim();
  return view.singleFlight(
    ["template", view.project, "create", storedTarget, storedName],
    () => createTemplateRemote({ target: storedTarget, name: storedName }).updates(readTemplateLibrary)
  );
};
