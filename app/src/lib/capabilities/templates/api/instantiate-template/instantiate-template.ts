import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { normalizeDocumentStyleSet } from "$representation/data/behavior/documents/typography";
import { ensureSlideDeckReady } from "$representation/data/behavior/slide-decks/normalize";
import { resolveTemplateScopes } from "$representation/data/behavior/templates/scopes";
import type { TemplateBody } from "$representation/data/types/templates/template";

import { validateInstantiateTemplate } from "$capabilities/templates/api/instantiate-template/validate-instantiate-template";
import { materializeSpreadsheet } from "$capabilities/templates/api/shared/bodies";
import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import { recordsIn } from "$capabilities/templates/api/shared/store";
import type {
  InstantiateTemplateResult,
  TemplateAnswers
} from "$capabilities/templates/types/templates";

const unknownSetsIn = (
  store: ReturnType<typeof serverModel>["store"],
  projectId: string,
  answers: TemplateAnswers
): readonly string[] => {
  const held = new Set(
    recordsIn(store, "resourceSets")
      .filter((row) => row.projectId === projectId && typeof row._id === "string")
      .map((row) => row._id as string)
  );
  const named = new Set<string>();
  for (const answer of Object.values(answers)) {
    for (const term of [...answer.include, ...answer.exclude]) {
      if (term.select === "set") named.add(term.setId);
    }
  }
  return [...named].filter((id) => !held.has(id)).sort();
};

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

  const answers = asked.answers ?? {};
  const unknownSets = unknownSetsIn(store, scope.projectId, answers);
  if (unknownSets.length > 0) {
    return {
      accepted: false,
      templateId: template._id,
      reason: "unsupported-body",
      revision: template.revision,
      detail: `this project holds no resource set ${unknownSets.join(", ")}`
    };
  }
  const resolved = resolveTemplateScopes(body, variables, answers);
  if (!resolved.accepted) {
    return {
      accepted: false,
      templateId: template._id,
      reason: resolved.reason,
      revision: template.revision,
      detail: resolved.detail
    };
  }
  if (resolved.undeclared.length > 0) {
    return {
      accepted: false,
      templateId: template._id,
      reason: "unsupported-body",
      revision: template.revision,
      detail: `the body names a variable the template does not declare: ${resolved.undeclared.join(", ")}`
    };
  }
  body = resolved.body;

  const projectId = asId<"projects">(scope.projectId);
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const at = Date.now();
  const title = asked.name ?? template.name;
  store.update(`templates.${template._id}.lastUsedAt`, at);

  if (body.resource === "document") {
    const { resource: _resource, ...documentBody } = body;
    const readyBody = documentBody.styles === undefined
      ? documentBody
      : { ...documentBody, styles: normalizeDocumentStyleSet(documentBody.styles) };
    const resourceId = store.create("documents", {
      projectId,
      title,
      createdBy: actor,
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

  const materialized = materializeSpreadsheet(body);
  const resourceId = store.create("spreadsheets", {
    projectId,
    title,
    createdBy: actor,
    updatedBy: { ...actor },
    updatedAt: at
  });
  store.create("spreadsheetSnapshots", {
    projectId,
    resourceId,
    revision: 0,
    role: "leader",
    part: 0,
    body: materialized.body,
    at
  });
  store.createMany(
    "sheetCells",
    materialized.cells.map((cell) => ({ projectId, resourceId, ...cell }))
  );
  return {
    accepted: true,
    templateId: template._id,
    templateRevision: template.revision,
    target: body.resource,
    resourceId,
    revision: 0
  };
};
