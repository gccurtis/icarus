import type { ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import {
  fillTemplateAtoms,
  resolveTemplateScopes
} from "$representation/data/behavior/templates/scopes";
import type {
  TemplateBody,
  TemplateSlot
} from "$representation/data/types/templates/template";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

import { writeTemplateResource } from "$capabilities/templates/api/shared/template-resource";
import { kindOf } from "$capabilities/templates/api/shared/slots";
import { placementSetRefusal } from "$capabilities/templates/api/shared/placement-inputs";
import {
  normalizeScope,
  privateSlotDefaultOf
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
  readonly slots: readonly TemplateSlot[];
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

const placedResourceRef = (target: TemplateBody["resource"], resourceId: string): ResourceRef =>
  target === "document"
    ? { kind: "document", id: asId<"documents">(resourceId) }
    : target === "presentation"
      ? { kind: "presentation", id: asId<"presentations">(resourceId) }
      : { kind: "spreadsheet", id: asId<"spreadsheets">(resourceId) };

/** Resolves slots and commits one complete new resource revision atomically. */
export const placeTemplate = ({
  model,
  projectId: project,
  userId,
  templateId,
  templateRevision,
  templateName,
  body,
  slots,
  answers,
  texts,
  name
}: PlaceTemplateInput): InstantiateTemplateResult => {
  const projectId = asId<"projects">(project);
  const actor = { kind: "user" as const, userId: asId<"users">(userId) };
  const at = Date.now();
  const table = body.resource === "document"
    ? "documents"
    : body.resource === "presentation"
      ? "presentations"
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
      const ref = placedResourceRef(body.resource, resourceId);
      const answered: Record<string, TemplateAnswers[string]> = {};
      const setRefusal = placementSetRefusal(unit, project, answers);
      if (setRefusal !== undefined) {
        throw rejected(templateId, templateRevision, setRefusal);
      }

      for (const [slot, rule] of Object.entries(answers)) {
        const term = normalizeScope(
          unit,
          project,
          actor,
          { kind: "resource", ref, slot },
          rule,
          at
        );
        if (term !== undefined) answered[slot] = term.term as TemplateAnswers[string];
      }

      for (const slot of slots) {
        if (kindOf(slot) !== "scope" || answers[slot.name] !== undefined) continue;
        const storedDefault = privateSlotDefaultOf(
          unit,
          project,
          { kind: "slot", templateId, slot: slot.name },
          slot.default
        );
        if (storedDefault.kind === "invalid") {
          throw rejected(
            templateId,
            templateRevision,
            `scope slot '${slot.name}' has an invalid private resource set ${storedDefault.setId}`
          );
        }
        if (storedDefault.kind !== "private") continue;
        const term = normalizeScope(
          unit,
          project,
          actor,
          { kind: "resource", ref, slot: slot.name },
          storedDefault.rule,
          at
        );
        if (term !== undefined) answered[slot.name] = term.term as TemplateAnswers[string];
      }

      const resolved = resolveTemplateScopes(body, slots, answered);
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
          `the body names a slot the template does not declare: ${resolved.undeclared.join(", ")}`
        );
      }

      const filled = fillTemplateAtoms(resolved.body, texts);
      const ready = withFreshOutputs(
        unit,
        project,
        actor,
        ref,
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
