import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { normalizeDocumentStyleSet } from "$representation/data/behavior/documents/typography";
import { ensureSlideDeckReady } from "$representation/data/behavior/slide-decks/normalize";
import {
  fillTemplateAtoms,
  resolveTemplateScopes
} from "$representation/data/behavior/templates/scopes";
import type { TemplateBody } from "$representation/data/types/templates/template";

import { enqueueSemanticSync } from "$capabilities/semantic-overlay/index";
import { validateInstantiateTemplate } from "$capabilities/templates/api/instantiate-template/validate-instantiate-template";
import { materializeSpreadsheet } from "$capabilities/templates/api/shared/bodies";
import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import { normalizeScope, unknownSetsIn } from "$capabilities/templates/api/shared/scopes";
import { kindOf } from "$capabilities/templates/api/shared/holes";
import { withFreshOutputs } from "$capabilities/templates/api/shared/prompts";
import type {
  InstantiateTemplateResult,
  TemplateAnswers
} from "$capabilities/templates/types/templates";

class PlacementRejected extends Error {
  readonly result: InstantiateTemplateResult;

  constructor(result: InstantiateTemplateResult) {
    super("Template placement was rejected");
    this.result = result;
  }
}

const unknownSetsInAnswers = (
  store: ReturnType<typeof serverModel>["store"],
  projectId: string,
  answers: TemplateAnswers
): readonly string[] => {
  const missing = new Set<string>();
  for (const answer of Object.values(answers)) {
    for (const id of unknownSetsIn(store, projectId, answer)) missing.add(id);
  }
  return [...missing].sort();
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
  let holes;
  try {
    template = admitStoredTemplate(stored);
    body = template.body;
    holes = template.holes;
  } catch (error) {
    return {
      accepted: false,
      templateId: stored._id,
      reason: "unsupported-body",
      revision: reportableRevision(stored.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  /** A text hole untouched by the caller falls back to its own default words. */
  const texts: Record<string, string> = { ...asked.texts };
  for (const hole of holes) {
    if (kindOf(hole) !== "text" || hole.text === undefined) continue;
    if (texts[hole.name] === undefined) texts[hole.name] = hole.text;
  }
  const unfilled = holes
    .filter((hole) => kindOf(hole) === "text")
    .map((hole) => hole.name)
    .filter((name) => texts[name] === undefined || texts[name].trim() === "");
  if (unfilled.length > 0) {
    return {
      accepted: false,
      templateId: template._id,
      reason: "unsupported-body",
      revision: template.revision,
      detail: `these need words before the template can be placed: ${unfilled.join(", ")}`
    };
  }

  const answers = asked.answers ?? {};
  const unknownSets = unknownSetsInAnswers(store, scope.projectId, answers);
  if (unknownSets.length > 0) {
    return {
      accepted: false,
      templateId: template._id,
      reason: "unsupported-body",
      revision: template.revision,
      detail: `this project holds no resource set ${unknownSets.join(", ")}`
    };
  }

  const projectId = asId<"projects">(scope.projectId);
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const at = Date.now();
  const title = asked.name ?? template.name;

  const table =
    body.resource === "document" ? "documents" : body.resource === "slides" ? "slideDecks" : "spreadsheets";
  let placed: {
    readonly result: Extract<InstantiateTemplateResult, { accepted: true }>;
    readonly semanticKind: "document" | "slides" | "spreadsheet";
  };
  try {
    placed = store.transaction((unit) => {
      const resourceId = unit.create(table, {
        projectId,
        title,
        createdBy: actor,
        updatedBy: { ...actor },
        updatedAt: at
      });
      const answered: Record<string, TemplateAnswers[string]> = {};
      for (const [name, rule] of Object.entries(answers)) {
        const term = normalizeScope(
          unit,
          scope.projectId,
          actor,
          { kind: "resource", resourceId, hole: name },
          rule,
          at
        );
        if (term !== undefined) answered[name] = term.term as TemplateAnswers[string];
      }

      const resolved = resolveTemplateScopes(body, holes, answered);
      if (!resolved.accepted) {
        throw new PlacementRejected({
          accepted: false,
          templateId: template._id,
          reason: resolved.reason,
          revision: template.revision,
          detail: resolved.detail
        });
      }
      if (resolved.undeclared.length > 0) {
        throw new PlacementRejected({
          accepted: false,
          templateId: template._id,
          reason: "unsupported-body",
          revision: template.revision,
          detail: `the body names a hole the template does not declare: ${resolved.undeclared.join(", ")}`
        });
      }

      body = fillTemplateAtoms(resolved.body, texts);
      body = withFreshOutputs(
        unit,
        scope.projectId,
        actor,
        { kind: body.resource, id: resourceId },
        body,
        at
      ).body;
      unit.update(`templates.${template._id}.lastUsedAt`, at);

      if (body.resource === "document") {
        const { resource: _resource, ...documentBody } = body;
        const readyBody = documentBody.styles === undefined
          ? documentBody
          : { ...documentBody, styles: normalizeDocumentStyleSet(documentBody.styles) };
        unit.create("documentSnapshots", {
          projectId,
          resourceId,
          revision: 0,
          role: "leader",
          part: 0,
          body: readyBody,
          at
        });
        return {
          semanticKind: "document" as const,
          result: {
            accepted: true as const,
            templateId: template._id,
            templateRevision: template.revision,
            target: body.resource,
            resourceId,
            revision: 0 as const
          }
        };
      }

      if (body.resource === "slides") {
        const { resource: _resource, ...slideDeckBody } = body;
        unit.create("slideDeckSnapshots", {
          projectId,
          resourceId,
          revision: 0,
          role: "leader",
          part: 0,
          body: ensureSlideDeckReady(slideDeckBody),
          at
        });
        return {
          semanticKind: "slides" as const,
          result: {
            accepted: true as const,
            templateId: template._id,
            templateRevision: template.revision,
            target: body.resource,
            resourceId,
            revision: 0 as const
          }
        };
      }

      const materialized = materializeSpreadsheet(body);
      unit.create("spreadsheetSnapshots", {
        projectId,
        resourceId,
        revision: 0,
        role: "leader",
        part: 0,
        body: materialized.body,
        at
      });
      unit.createMany(
        "sheetCells",
        materialized.cells.map((cell) => ({ projectId, resourceId, ...cell }))
      );
      return {
        semanticKind: "spreadsheet" as const,
        result: {
          accepted: true as const,
          templateId: template._id,
          templateRevision: template.revision,
          target: body.resource,
          resourceId,
          revision: 0 as const
        }
      };
    });
  } catch (error) {
    if (error instanceof PlacementRejected) return error.result;
    throw error;
  }

  await enqueueSemanticSync({
    ref: { kind: placed.semanticKind, id: placed.result.resourceId }
  });
  return placed.result;
};
