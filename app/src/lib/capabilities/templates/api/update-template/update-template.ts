import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { scopeSlotNamesIn } from "$representation/data/behavior/templates/scopes";

import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import {
  normalizeScope,
  setReferencesIn
} from "$capabilities/templates/api/shared/scopes";
import { removeRowsBoundTo } from "$capabilities/templates/api/shared/scope-rows";
import { stagesIn } from "$capabilities/templates/api/shared/stages";
import type { RowFields } from "$capabilities/templates/api/shared/store";
import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
import {
  templateNameConflictDetail,
  templateNameTaken
} from "$capabilities/templates/api/shared/template-names";
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
  let slots = [...(asked.patch.slots ?? template.slots)];
  if (asked.patch.slots !== undefined) {
    const declared = new Set(slots.map((slot) => slot.name));
    const orphaned = scopeSlotNamesIn(template.body).filter((name) => !declared.has(name));
    if (orphaned.length > 0) {
      return {
        accepted: false,
        templateId: asked.templateId,
        reason: "slot-in-use",
        revision: template.revision,
        detail: `the body still names ${orphaned.join(", ")}`
      };
    }
    for (const slot of slots) {
      const references = setReferencesIn(
        store,
        scope.projectId,
        slot.default ?? { include: [], exclude: [] }
      );
      if (references.missing.length > 0) {
        return {
          accepted: false,
          templateId: asked.templateId,
          reason: "unsupported-body",
          revision: template.revision,
          detail: `no set in this project has id ${references.missing.join(", ")}`
        };
      }
      if (references.private.length > 0) {
        return {
          accepted: false,
          templateId: asked.templateId,
          reason: "unsupported-body",
          revision: template.revision,
          detail: `a template default may reference only named reusable resource sets; ${references.private.join(", ")} is private`
        };
      }
    }
  }
  if (asked.patch.slotDescription !== undefined) {
    const asking = asked.patch.slotDescription;
    if (!slots.some((candidate) => candidate.name === asking.name)) {
      return {
        accepted: false,
        templateId: asked.templateId,
        reason: "unsupported-body",
        revision: template.revision,
        detail: `the template no longer declares slot ${asking.name}`
      };
    }
    slots = slots.map((candidate) => {
      if (candidate.name !== asking.name) return candidate;
      const { description: _description, ...rest } = candidate;
      return asking.description === null ? rest : { ...rest, description: asking.description };
    });
  }
  const fields = store.transaction((unit): RowFields<"templates"> | undefined => {
    const name = asked.patch.name ?? template.name;
    if (templateNameTaken(unit, scope.projectId, name, template._id)) return undefined;
    let storedSlots = slots;
    if (asked.patch.slots !== undefined) {
      for (const held of template.slots) {
        if (slots.some((slot) => slot.name === held.name)) continue;
        removeRowsBoundTo(unit, scope.projectId, {
          kind: "slot",
          templateId: template._id,
          slot: held.name
        });
      }
      storedSlots = slots.map((slot) => {
        const written = normalizeScope(
          unit,
          scope.projectId,
          actor,
          { kind: "slot", templateId: template._id, slot: slot.name },
          slot.default,
          at
        );
        return {
          name: slot.name,
          label: slot.label,
          ...(slot.description === undefined ? {} : { description: slot.description }),
          kind: slot.kind,
          ...(slot.text === undefined ? {} : { text: slot.text }),
          ...(written === undefined ? {} : { default: written.term })
        };
      });
    }
    const next: RowFields<"templates"> = {
      projectId: template.projectId,
      userId: template.userId,
      name,
      ...(description === undefined ? {} : { description }),
      tags: [...(asked.patch.tags ?? template.tags)],
      body: template.body,
      slots: storedSlots,
      createdBy: template.createdBy,
      revision: template.revision + 1,
      updatedAt: at
    };
    unit.update(`templates.${template._id}`, next);
    writeTemplateVersion(unit, template._id, next, at);
    for (const stage of stagesIn(unit)) {
      if (stage.templateId !== template._id) continue;
      unit.update(`templateStages.${stage._id}.templateRevision`, next.revision);
    }
    return next;
  });

  if (fields === undefined) {
    const name = asked.patch.name ?? template.name;
    return {
      accepted: false,
      templateId: template._id,
      reason: "name-in-use",
      revision: template.revision,
      detail: templateNameConflictDetail(name)
    };
  }

  return { accepted: true, templateId: template._id, revision: fields.revision };
};
