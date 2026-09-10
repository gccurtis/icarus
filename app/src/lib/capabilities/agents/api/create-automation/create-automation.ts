import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateCreateAutomation } from "$capabilities/agents/api/create-automation/validate-create-automation";
import { findVisible, notFound, refused, viewer } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import { scopeReferenceRefusal } from "$capabilities/agents/api/shared/scope-references";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const createAutomation = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateCreateAutomation(input);

  const store = serverModel().store;
  const found = findVisible(store, scope, "personas", asked.personaId);
  if (found.kind !== "found") return notFound(asked.personaId, "persona");
  const persona = found.row;
  const scopeRefusal = scopeReferenceRefusal(store, scope.projectId, asked.scope);
  if (scopeRefusal !== undefined) {
    return refused(asked.personaId, "invalid-state", scopeRefusal);
  }
  const at = Date.now();
  const fields: RowFields<"automations"> = {
    projectId: asId<"projects">(scope.projectId),
    name: asked.name,
    personaId: persona._id,
    instruction: asked.instruction ?? "",
    trigger: asked.trigger ?? { kind: "manual" },
    ...(asked.scope === undefined ? {} : { scope: asked.scope }),
    tools: [...(asked.tools ?? persona.tools)],
    enabled: asked.instruction !== undefined,
    firedCount: 0,
    createdBy: viewer(scope),
    revision: 1,
    updatedAt: at
  };
  const id = store.create("automations", fields);
  return { accepted: true, id, revision: 1 };
};
