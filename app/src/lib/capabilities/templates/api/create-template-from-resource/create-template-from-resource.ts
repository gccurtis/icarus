import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { deckOfSlide } from "$representation/data/behavior/templates/deck-of-slide";
import { portableBodyOf } from "$representation/data/behavior/templates/portable";
import type { TemplateBody } from "$representation/data/types/templates/template";

import { validateCreateTemplateFromResource } from "$capabilities/templates/api/create-template-from-resource/validate-create-template-from-resource";
import { leaderBodyOf, resourceTableOf } from "$capabilities/templates/api/shared/stages";
import { recordsIn, type RowFields } from "$capabilities/templates/api/shared/store";
import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
import { bodyOf } from "$capabilities/templates/api/shared/validation";
import { declaredFor } from "$capabilities/templates/api/shared/variables";
import type { CreateTemplateFromResourceResult } from "$capabilities/templates/types/templates";

export const createTemplateFromResource = async (
  input: unknown
): Promise<CreateTemplateFromResourceResult> => {
  const scope = await requireScope();
  const asked = validateCreateTemplateFromResource(input);

  const store = serverModel().store;
  const table = resourceTableOf(asked.target);
  const resource = recordsIn(store, table).find(
    (row) => row._id === asked.resourceId && row.projectId === scope.projectId
  );
  const leader =
    resource === undefined
      ? undefined
      : leaderBodyOf(store, scope.projectId, asked.target, asked.resourceId);
  if (resource === undefined || leader === undefined) {
    return {
      accepted: false,
      resourceId: asked.resourceId,
      reason: "not-found",
      detail: resource === undefined ? "no such resource in this project" : "the resource has no body yet"
    };
  }

  let candidate: unknown;
  if (leader.target === "document") {
    candidate = { resource: "document", ...leader.body };
  } else if (asked.slideId === undefined) {
    candidate = { resource: "slides", ...leader.body };
  } else {
    const slide = deckOfSlide(leader.body, asked.slideId);
    if (slide === undefined) {
      return {
        accepted: false,
        resourceId: asked.resourceId,
        reason: "not-found",
        detail: "the deck has no such slide"
      };
    }
    candidate = { resource: "slides", ...slide };
  }

  const portable = portableBodyOf(candidate);
  let body: TemplateBody;
  try {
    body = bodyOf(portable.body, "create-template-from-resource");
  } catch (error) {
    return {
      accepted: false,
      resourceId: asked.resourceId,
      reason: "unsupported-body",
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  const at = Date.now();
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const fields: RowFields<"templates"> = {
    projectId: asId<"projects">(scope.projectId),
    userId: actor.userId,
    name: asked.name,
    ...(asked.description === undefined ? {} : { description: asked.description }),
    tags: [...(asked.tags ?? [])],
    body,
    variables: declaredFor(body, []),
    createdBy: actor,
    revision: 1,
    updatedAt: at
  };
  const templateId = store.create("templates", fields);
  writeTemplateVersion(store, templateId, fields, at);

  return { accepted: true, templateId, target: asked.target, revision: 1, dropped: portable.dropped };
};
