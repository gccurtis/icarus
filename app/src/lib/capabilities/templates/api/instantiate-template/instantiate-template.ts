import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { placeTemplate } from "$capabilities/templates/api/shared/template-placement";
import { validateInstantiateTemplate } from "$capabilities/templates/api/instantiate-template/validate-instantiate-template";
import { placementInputsOf } from "$capabilities/templates/api/shared/placement-inputs";
import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import type { InstantiateTemplateResult } from "$capabilities/templates/types/templates";

export const instantiateTemplate = async (input: unknown): Promise<InstantiateTemplateResult> => {
  const scope = await requireScope();
  const asked = validateInstantiateTemplate(input);

  const model = serverModel();
  const store = model.store;
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
  let template: ReturnType<typeof admitStoredTemplate>;
  try {
    template = admitStoredTemplate(stored);
  } catch (error) {
    return {
      accepted: false,
      templateId: stored._id,
      reason: "unsupported-body",
      revision: reportableRevision(stored.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  const inputs = placementInputsOf(template.holes, asked.answers ?? {}, asked.texts ?? {});
  if (!inputs.accepted) {
    return {
      accepted: false,
      templateId: template._id,
      reason: "unsupported-body",
      revision: template.revision,
      detail: inputs.detail
    };
  }

  return placeTemplate({
    model,
    projectId: scope.projectId,
    userId: scope.userId,
    templateId: template._id,
    templateRevision: template.revision,
    templateName: template.name,
    body: template.body,
    holes: template.holes,
    answers: asked.answers ?? {},
    texts: inputs.texts,
    ...(asked.name === undefined ? {} : { name: asked.name })
  });
};
