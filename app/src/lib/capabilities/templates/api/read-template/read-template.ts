import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { detailOf, visibleTemplate } from "$capabilities/templates/api/shared/projection";
import { validateReadTemplate } from "$capabilities/templates/api/read-template/validate-read-template";
import type { ReadTemplateResult } from "$capabilities/templates/types/templates";

export const readTemplate = async (input: unknown): Promise<ReadTemplateResult> => {
  const scope = await requireScope();
  const asked = validateReadTemplate(input);

  const store = serverModel().store;
  const found = visibleTemplate(store, scope, asked.templateId);
  if (found.kind === "missing") return null;
  if (found.kind === "ambiguous") {
    return {
      unavailable: true,
      templateId: found.templateId,
      reason: "corrupt",
      detail: found.detail
    };
  }
  const template = found.template;

  try {
    return detailOf(store, scope, template);
  } catch (error) {
    return {
      unavailable: true,
      templateId: template._id,
      reason: "corrupt",
      detail: error instanceof Error ? error.message : String(error)
    };
  }
};
