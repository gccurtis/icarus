import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateDuplicateTemplate } from "$capabilities/templates/api/duplicate-template/validate-duplicate-template";
import { settledHoleDefaults } from "$capabilities/templates/api/shared/prompts";
import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import { expandedScope } from "$capabilities/templates/api/shared/scopes";
import type { RowFields } from "$capabilities/templates/api/shared/store";
import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
import type { DuplicateTemplateResult } from "$capabilities/templates/types/templates";

const COPY_SUFFIX = " copy";
const copyName = (name: string): string =>
  `${name.slice(0, 160 - COPY_SUFFIX.length).trimEnd()}${COPY_SUFFIX}`;

export const duplicateTemplate = async (input: unknown): Promise<DuplicateTemplateResult> => {
  const scope = await requireScope();
  const asked = validateDuplicateTemplate(input);

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

  let source: ReturnType<typeof admitStoredTemplate>;
  let holes: ReturnType<typeof admitStoredTemplate>["holes"];
  try {
    source = admitStoredTemplate(stored);
    holes = source.holes.map((hole) => {
      const expanded = expandedScope(
        store,
        scope.projectId,
        { kind: "hole", templateId: source._id, hole: hole.name },
        hole.default
      );
      return expanded === undefined ? hole : { ...hole, default: expanded };
    });
  } catch (error) {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: "unsupported-body",
      revision: reportableRevision(stored.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  const at = Date.now();
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const fields: RowFields<"templates"> = {
    projectId: asId<"projects">(scope.projectId),
    userId: actor.userId,
    name: asked.name ?? copyName(source.name),
    ...(source.description === undefined ? {} : { description: source.description }),
    tags: [...source.tags],
    body: structuredClone(source.body),
    holes: structuredClone(holes),
    createdBy: actor,
    revision: 1,
    updatedAt: at
  };
  const templateId = store.transaction((unit) => {
    const id = unit.create("templates", fields);
    const holes = settledHoleDefaults(unit, scope.projectId, actor, id, fields.holes, at);
    const stored = { ...fields, holes: [...holes] };
    unit.update(`templates.${id}`, stored);
    writeTemplateVersion(unit, id, stored, at);
    return id;
  });

  return {
    accepted: true,
    templateId,
    sourceTemplateId: source._id,
    target: source.body.resource,
    revision: 1
  };
};
