import {
  instantiateTemplate as instantiateTemplateRemote,
  readTemplateLibrary,
  type TemplateAnswers
} from "$capabilities/templates/index.remote";
import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LibraryTemplate } from "$app-views/categories/templates/procedures/library-types";

export const instantiateTemplate = (
  view: WorkspaceStateModel,
  row: LibraryTemplate,
  answers: TemplateAnswers = {},
  texts: Readonly<Record<string, string>> = {}
) =>
  view.singleFlight(
    ["template", view.project, row.id, "instantiate", JSON.stringify(answers), JSON.stringify(texts)],
    () =>
      instantiateTemplateRemote({
        templateId: row.id,
        ...(Object.keys(answers).length === 0 ? {} : { answers }),
        ...(Object.keys(texts).length === 0 ? {} : { texts })
      }).updates(readTemplateLibrary, readProjectResourceIndex)
  );
