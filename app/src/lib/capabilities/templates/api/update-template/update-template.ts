import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { scopeHoleNamesIn } from "$representation/data/behavior/templates/scopes";

import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import {
  normalizeScope,
  removeRowsBoundTo,
  unknownSetsIn
} from "$capabilities/templates/api/shared/scopes";
import { stagesIn } from "$capabilities/templates/api/shared/stages";
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
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  let holes = [...(asked.patch.holes ?? template.holes)];
  if (asked.patch.holes !== undefined) {
    const declared = new Set(holes.map((hole) => hole.name));
    const orphaned = scopeHoleNamesIn(template.body).filter((name) => !declared.has(name));
    if (orphaned.length > 0) {
      return {
        accepted: false,
        templateId: asked.templateId,
        reason: "hole-in-use",
        revision: template.revision,
        detail: `the body still names ${orphaned.join(", ")}`
      };
    }
    for (const hole of holes) {
      const missing = unknownSetsIn(
        store,
        scope.projectId,
        hole.default ?? { include: [], exclude: [] }
      );
      if (missing.length > 0) {
        return {
          accepted: false,
          templateId: asked.templateId,
          reason: "unsupported-body",
          revision: template.revision,
          detail: `no set in this project has id ${missing.join(", ")}`
        };
      }
    }
    for (const held of template.holes) {
      if (holes.some((hole) => hole.name === held.name)) continue;
      removeRowsBoundTo(store, scope.projectId, {
        kind: "hole",
        templateId: template._id,
        hole: held.name
      });
    }
    holes = holes.map((hole) => {
      const written = normalizeScope(
        store,
        scope.projectId,
        actor,
        { kind: "hole", templateId: template._id, hole: hole.name },
        hole.default,
        at
      );
      return {
        name: hole.name,
        label: hole.label,
        ...(hole.description === undefined ? {} : { description: hole.description }),
        ...(hole.kind === undefined ? {} : { kind: hole.kind }),
        ...(hole.text === undefined ? {} : { text: hole.text }),
        ...(written === undefined ? {} : { default: written.term })
      };
    });
  }
  if (asked.patch.holeDescription !== undefined) {
    const asking = asked.patch.holeDescription;
    if (!holes.some((candidate) => candidate.name === asking.name)) {
      return {
        accepted: false,
        templateId: asked.templateId,
        reason: "unsupported-body",
        revision: template.revision,
        detail: `the template no longer declares hole ${asking.name}`
      };
    }
    holes = holes.map((candidate) => {
      if (candidate.name !== asking.name) return candidate;
      const { description: _description, ...rest } = candidate;
      return asking.description === null ? rest : { ...rest, description: asking.description };
    });
  }
  const fields: RowFields<"templates"> = {
    projectId: template.projectId,
    userId: template.userId,
    name: asked.patch.name ?? template.name,
    ...(description === undefined ? {} : { description }),
    tags: [...(asked.patch.tags ?? template.tags)],
    body: template.body,
    holes,
    createdBy: template.createdBy,
    revision: template.revision + 1,
    updatedAt: at
  };
  store.update(`templates.${template._id}`, fields);
  writeTemplateVersion(store, template._id, fields, at);
  for (const stage of stagesIn(store)) {
    if (stage.templateId !== template._id) continue;
    store.update(`templateStages.${stage._id}.templateRevision`, fields.revision);
  }

  return { accepted: true, templateId: template._id, revision: fields.revision };
};
