import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateDuplicateTemplate } from "$capabilities/templates/api/duplicate-template/validate-duplicate-template";
import { settledSlotDefaults } from "$capabilities/templates/api/shared/prompts";
import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import { expandedScope } from "$capabilities/templates/api/shared/scopes";
import type { RowFields } from "$capabilities/templates/api/shared/store";
import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
import {
  availableTemplateCopyName,
  templateNameConflictDetail,
  templateNameTaken
} from "$capabilities/templates/api/shared/template-names";
import type { DuplicateTemplateResult } from "$capabilities/templates/types/templates";

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
  let slots: ReturnType<typeof admitStoredTemplate>["slots"];
  try {
    source = admitStoredTemplate(stored);
    slots = source.slots.map((slot) => {
      const expanded = expandedScope(
        store,
        scope.projectId,
        { kind: "slot", templateId: source._id, slot: slot.name },
        slot.default
      );
      return expanded === undefined ? slot : { ...slot, default: expanded };
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
  const fields: Omit<RowFields<"templates">, "name"> = {
    projectId: asId<"projects">(scope.projectId),
    userId: actor.userId,
    ...(source.description === undefined ? {} : { description: source.description }),
    tags: [...source.tags],
    body: structuredClone(source.body),
    slots: structuredClone(slots),
    createdBy: actor,
    revision: 1,
    updatedAt: at
  };
  const created = store.transaction((unit) => {
    const name = asked.name ?? availableTemplateCopyName(unit, scope.projectId, source.name);
    if (asked.name !== undefined && templateNameTaken(unit, scope.projectId, name)) return undefined;
    const named: RowFields<"templates"> = { ...fields, name };
    const id = unit.create("templates", named);
    const slots = settledSlotDefaults(unit, scope.projectId, actor, id, named.slots, at);
    const stored = { ...named, slots: [...slots] };
    unit.update(`templates.${id}`, stored);
    writeTemplateVersion(unit, id, stored, at);
    return { id, name };
  });

  if (created === undefined) {
    return {
      accepted: false,
      templateId: source._id,
      reason: "name-in-use",
      revision: source.revision,
      detail: templateNameConflictDetail(asked.name ?? source.name)
    };
  }

  return {
    accepted: true,
    templateId: created.id,
    sourceTemplateId: source._id,
    target: source.body.resource,
    revision: 1
  };
};
