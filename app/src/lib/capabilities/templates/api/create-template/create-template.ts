import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateCreateTemplate } from "$capabilities/templates/api/create-template/validate-create-template";
import { emptyTemplateBody } from "$capabilities/templates/api/shared/bodies";
import type { RowFields } from "$capabilities/templates/api/shared/store";
import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
import type { CreateTemplateResult } from "$capabilities/templates/types/templates";

export const createTemplate = async (input: unknown): Promise<CreateTemplateResult> => {
  const scope = await requireScope();
  const asked = validateCreateTemplate(input);

  const store = serverModel().store;
  const at = Date.now();
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const fields: RowFields<"templates"> = {
    userId: actor.userId,
    name: asked.name,
    ...(asked.description === undefined ? {} : { description: asked.description }),
    tags: [...(asked.tags ?? [])],
    body: emptyTemplateBody(asked.target),
    variables: [],
    createdBy: actor,
    revision: 1,
    updatedAt: at
  };
  const templateId = store.create("templates", fields);
  writeTemplateVersion(store, templateId, fields, at);

  return { accepted: true, templateId, target: asked.target, revision: 1 };
};
