import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import type { RowFields } from "$capabilities/templates/api/shared/store";
import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
import { validateUpdateTemplate } from "$capabilities/templates/api/update-template/validate-update-template";
import type { UpdateTemplateResult } from "$capabilities/templates/types/templates";

export const updateTemplate = async (input: unknown): Promise<UpdateTemplateResult> => {
  const scope = await requireScope();
  const asked = validateUpdateTemplate(input);

  const store = serverModel().store;
  const found = visibleTemplate(store, scope, asked.templateId);
  if (found.kind !== "found") {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: found.kind === "missing" ? "not-found" : "unsupported-body",
      revision: null,
      detail: found.kind === "missing" ? "no visible template has that id" : found.detail
    };
  }
  const stored = found.template;
  if (stored.userId !== scope.userId) {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: "forbidden",
      revision: reportableRevision(stored.revision),
      detail: "only the template owner can change it"
    };
  }
  if (stored.revision !== asked.baseRevision) {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: "stale",
      revision: reportableRevision(stored.revision),
      detail: `authored against revision ${asked.baseRevision}, the template is at ${stored.revision}`
    };
  }

  let template: ReturnType<typeof admitStoredTemplate>;
  try {
    template = admitStoredTemplate(stored);
  } catch (error) {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: "unsupported-body",
      revision: reportableRevision(stored.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }
  if (template.revision === Number.MAX_SAFE_INTEGER) {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: "unsupported-body",
      revision: template.revision,
      detail: "the template revision counter is exhausted"
    };
  }
  const description =
    asked.patch.description === null
      ? undefined
      : (asked.patch.description ?? template.description);
  const at = Date.now();
  const fields: RowFields<"templates"> = {
    userId: template.userId,
    name: asked.patch.name ?? template.name,
    ...(description === undefined ? {} : { description }),
    tags: [...(asked.patch.tags ?? template.tags)],
    body: template.body,
    variables: [...template.variables],
    createdBy: template.createdBy,
    revision: template.revision + 1,
    updatedAt: at
  };
  store.update(`templates.${template._id}`, fields);
  writeTemplateVersion(store, template._id, fields, at);

  return { accepted: true, templateId: template._id, revision: fields.revision };
};
