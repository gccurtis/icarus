import type { ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import {
  fillTemplateAtoms,
  resolveTemplateScopes
} from "$representation/data/behavior/templates/scopes";
import type {
  TemplateBody,
  TemplateHole
} from "$representation/data/types/templates/template";
import type { Id } from "$representation/data/types/core/id";

import { writeTemplateResource } from "$capabilities/templates/api/shared/template-resource";
import { kindOf } from "$capabilities/templates/api/shared/holes";
import { placementSetRefusal } from "$capabilities/templates/api/shared/placement-inputs";
import {
  normalizeScope,
  privateHoleDefaultOf
} from "$capabilities/templates/api/shared/scopes";
import { withFreshOutputs } from "$capabilities/templates/api/shared/prompts";
import type {
  InstantiateTemplateResult,
  TemplateAnswers
} from "$capabilities/templates/types/templates";

type PlaceTemplateInput = {
  readonly model: ServerModel;
  readonly projectId: string;
  readonly userId: string;
  readonly templateId: Id<"templates">;
  readonly templateRevision: number;
  readonly templateName: string;
  readonly body: TemplateBody;
  readonly holes: readonly TemplateHole[];
  readonly answers: TemplateAnswers;
  readonly texts: Readonly<Record<string, string>>;
  readonly name?: string;
};

class PlacementRejected extends Error {
  readonly result: InstantiateTemplateResult;

  constructor(result: InstantiateTemplateResult) {
    super("Template placement was rejected");
    this.result = result;
  }
}

const rejected = (
  templateId: Id<"templates">,
  templateRevision: number,
  detail: string,
  reason: "unsupported-body" | "not-found" = "unsupported-body"
): PlacementRejected => new PlacementRejected({
  accepted: false,
  templateId,
  reason,
  revision: templateRevision,
  detail
});

/** Resolves holes and commits one complete new resource revision atomically. */
export const placeTemplate = ({
  model,
  projectId: project,
  userId,
  templateId,
  templateRevision,
  templateName,
  body,
  holes,
  answers,
  texts,
  name
}: PlaceTemplateInput): InstantiateTemplateResult => {
  const projectId = asId<"projects">(project);
  const actor = { kind: "user" as const, userId: asId<"users">(userId) };
  const at = Date.now();
  const table = body.resource === "document"
    ? "documents"
    : body.resource === "slides"
      ? "slideDecks"
      : "spreadsheets";

  try {
    return model.store.transaction((unit) => {
      const resourceId = unit.create(table, {
        projectId,
        title: name ?? templateName,
        createdBy: actor,
        updatedBy: { ...actor },
        updatedAt: at
      });
      const answered: Record<string, TemplateAnswers[string]> = {};
      const setRefusal = placementSetRefusal(unit, project, answers);
      if (setRefusal !== undefined) {
        throw rejected(templateId, templateRevision, setRefusal);
      }

      for (const [hole, rule] of Object.entries(answers)) {
        const term = normalizeScope(
          unit,
          project,
          actor,
          { kind: "resource", resourceId, hole },
          rule,
          at
        );
        if (term !== undefined) answered[hole] = term.term as TemplateAnswers[string];
      }

      for (const hole of holes) {
        if (kindOf(hole) !== "scope" || answers[hole.name] !== undefined) continue;
        const storedDefault = privateHoleDefaultOf(
          unit,
          project,
          { kind: "hole", templateId, hole: hole.name },
          hole.default
        );
        if (storedDefault.kind === "invalid") {
          throw rejected(
            templateId,
            templateRevision,
            `scope hole '${hole.name}' has an invalid private resource set ${storedDefault.setId}`
          );
        }
        if (storedDefault.kind !== "private") continue;
        const term = normalizeScope(
          unit,
          project,
          actor,
          { kind: "resource", resourceId, hole: hole.name },
          storedDefault.rule,
          at
        );
        if (term !== undefined) answered[hole.name] = term.term as TemplateAnswers[string];
      }

      const resolved = resolveTemplateScopes(body, holes, answered);
      if (!resolved.accepted) {
        throw new PlacementRejected({
          accepted: false,
          templateId,
          reason: resolved.reason,
          revision: templateRevision,
          detail: resolved.detail
        });
      }
      if (resolved.undeclared.length > 0) {
        throw rejected(
          templateId,
          templateRevision,
          `the body names a hole the template does not declare: ${resolved.undeclared.join(", ")}`
        );
      }

      const filled = fillTemplateAtoms(resolved.body, texts);
      const origin = filled.resource === "document"
        ? { kind: "document" as const, id: asId<"documents">(resourceId) }
        : filled.resource === "slides"
          ? { kind: "slides" as const, id: asId<"slideDecks">(resourceId) }
          : { kind: "spreadsheet" as const, id: asId<"spreadsheets">(resourceId) };
      const ready = withFreshOutputs(
        unit,
        project,
        actor,
        origin,
        filled,
        at
      ).body;
      unit.update(`templates.${templateId}.lastUsedAt`, at);

      return writeTemplateResource({
        model,
        unit,
        projectId,
        resourceId,
        templateId,
        templateRevision,
        body: ready,
        at
      });
    });
  } catch (error) {
    if (error instanceof PlacementRejected) return error.result;
    throw error;
  }
};
