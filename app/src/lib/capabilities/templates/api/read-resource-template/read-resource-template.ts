import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateReadResourceTemplate } from "$capabilities/templates/api/read-resource-template/validate-read-resource-template";
import { admitStoredTemplate, visibleTemplate } from "$capabilities/templates/api/shared/projection";
import { resourceTableOfId, stageOfResource } from "$capabilities/templates/api/shared/stages";
import { recordsIn } from "$capabilities/templates/api/shared/store";
import type { ReadResourceTemplateResult } from "$capabilities/templates/types/templates";

export const readResourceTemplate = async (input: unknown): Promise<ReadResourceTemplateResult> => {
  const scope = await requireScope();
  const asked = validateReadResourceTemplate(input);

  const store = serverModel().store;
  const table = resourceTableOfId(asked.resourceId);
  const resource =
    table === undefined
      ? undefined
      : recordsIn(store, table).find(
          (row) => row._id === asked.resourceId && row.projectId === scope.projectId
        );
  if (resource === undefined) return { resourceId: asked.resourceId, stage: null };

  const held = stageOfResource(store, scope.projectId, asked.resourceId);
  if (held === undefined) return { resourceId: asked.resourceId, stage: null };

  const found = visibleTemplate(store, scope, held.templateId);
  let template: ReturnType<typeof admitStoredTemplate> | undefined;
  if (found.kind === "found") {
    try {
      template = admitStoredTemplate(found.template);
    } catch {
      template = undefined;
    }
  }

  return {
    resourceId: asked.resourceId,
    stage: {
      stageId: held._id,
      templateId: held.templateId,
      templateName: template?.name ?? "Unavailable template",
      target: held.target,
      stagedRevision: held.templateRevision,
      currentRevision: template?.revision ?? null
    }
  };
};
