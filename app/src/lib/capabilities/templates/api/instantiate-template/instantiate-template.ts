import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { normalizeDocumentStyleSet } from "$representation/data/behavior/documents/typography";
import { ensureSlideDeckReady } from "$representation/data/behavior/slide-decks/normalize";
import type { TemplateBody } from "$representation/data/types/templates/template";

import { validateInstantiateTemplate } from "$capabilities/templates/api/instantiate-template/validate-instantiate-template";
import { resolveTemplateDefaults } from "$capabilities/templates/api/shared/bodies";
import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import type { InstantiateTemplateResult } from "$capabilities/templates/types/templates";

export const instantiateTemplate = async (input: unknown): Promise<InstantiateTemplateResult> => {
  const scope = await requireScope();
  const asked = validateInstantiateTemplate(input);

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
  let template: ReturnType<typeof admitStoredTemplate>;
  let body: TemplateBody;
  let variables;
  try {
    template = admitStoredTemplate(stored);
    body = template.body;
    variables = template.variables;
  } catch (error) {
    return {
      accepted: false,
      templateId: stored._id,
      reason: "unsupported-body",
      revision: reportableRevision(stored.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }
  const resolved = resolveTemplateDefaults(body, variables);
  if (!resolved.accepted) {
    if (resolved.reason === "unsupported-body") {
      return {
        accepted: false,
        templateId: template._id,
        reason: resolved.reason,
        revision: template.revision,
        detail: resolved.detail
      };
    }
    return {
      accepted: false,
      templateId: template._id,
      reason: "variables-required",
      revision: template.revision,
      detail: "one or more template variables need answers and have no usable default",
      variables: resolved.variables
    };
  }
  body = resolved.body;

  const projectId = asId<"projects">(scope.projectId);
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const at = Date.now();
  const title = asked.name ?? template.name;

  if (body.resource === "document") {
    const { resource: _resource, ...documentBody } = body;
    const readyBody = documentBody.styles === undefined
      ? documentBody
      : { ...documentBody, styles: normalizeDocumentStyleSet(documentBody.styles) };
    const resourceId = store.create("documents", {
      projectId,
      title,
      templateId: template._id,
      createdBy: actor,
      // The file store requires a tree rather than a graph: two properties may
      // not share one object reference even when JSON could stringify it.
      updatedBy: { ...actor },
      updatedAt: at
    });
    store.create("documentSnapshots", {
      projectId,
      resourceId,
      revision: 0,
      role: "leader",
      part: 0,
      body: readyBody,
      at
    });
    return {
      accepted: true,
      templateId: template._id,
      templateRevision: template.revision,
      target: body.resource,
      resourceId,
      revision: 0
    };
  }

  if (body.resource === "slides") {
    const { resource: _resource, ...slideDeckBody } = body;
    const readyBody = ensureSlideDeckReady(slideDeckBody);
    const resourceId = store.create("slideDecks", {
      projectId,
      title,
      templateId: template._id,
      createdBy: actor,
      updatedBy: { ...actor },
      updatedAt: at
    });
    store.create("slideDeckSnapshots", {
      projectId,
      resourceId,
      revision: 0,
      role: "leader",
      part: 0,
      body: readyBody,
      at
    });
    return {
      accepted: true,
      templateId: template._id,
      templateRevision: template.revision,
      target: body.resource,
      resourceId,
      revision: 0
    };
  }

  return {
    accepted: false,
    templateId: template._id,
    reason: "unsupported-body",
    revision: template.revision,
    detail: "a spreadsheet template cannot be instantiated while the sheet representation is being rebuilt"
  };
};
