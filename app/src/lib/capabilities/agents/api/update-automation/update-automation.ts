import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { findVisible, notFound, refused, stale } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import { scopeReferenceRefusal } from "$capabilities/agents/api/shared/scope-references";
import { validateUpdateAutomation } from "$capabilities/agents/api/update-automation/validate-update-automation";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const updateAutomation = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateUpdateAutomation(input);

  const store = serverModel().store;
  const found = findVisible(store, scope, "automations", asked.automationId);
  if (found.kind !== "found") return notFound(asked.automationId, "automation");
  const automation = found.row;
  if (automation.revision !== asked.baseRevision) {
    return stale(asked.automationId, asked.baseRevision, automation.revision);
  }
  const patch = asked.patch;
  if (
    patch.personaId !== undefined &&
    !found.visible.personas.some((persona) => persona._id === patch.personaId)
  ) {
    return refused(asked.automationId, "not-found", "no visible persona has that id", automation.revision);
  }
  const instruction = patch.instruction ?? automation.instruction;
  if ((patch.enabled ?? automation.enabled) && instruction.trim() === "" && patch.enabled === true) {
    return refused(
      asked.automationId,
      "invalid-state",
      "write the instruction before switching it on",
      automation.revision
    );
  }

  const { lastFiredAt, scope: reach } = automation;
  const nextScope = patch.scope === undefined ? reach : (patch.scope ?? undefined);
  const scopeRefusal = scopeReferenceRefusal(store, scope.projectId, nextScope);
  if (scopeRefusal !== undefined) {
    return refused(automation._id, "invalid-state", scopeRefusal, automation.revision);
  }
  const fields: RowFields<"automations"> = {
    projectId: automation.projectId,
    name: patch.name ?? automation.name,
    instruction,
    personaId: patch.personaId === undefined ? automation.personaId : asId<"personas">(patch.personaId),
    trigger: patch.trigger ?? automation.trigger,
    ...(nextScope === undefined ? {} : { scope: nextScope }),
    tools: [...(patch.tools ?? automation.tools)],
    enabled: patch.enabled ?? automation.enabled,
    firedCount: automation.firedCount,
    ...(lastFiredAt === undefined ? {} : { lastFiredAt }),
    createdBy: automation.createdBy,
    revision: automation.revision + 1,
    updatedAt: Date.now()
  };
  store.update(`automations.${automation._id}`, fields);
  return { accepted: true, id: automation._id, revision: fields.revision };
};
