import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateCreateTask } from "$capabilities/agents/api/create-task/validate-create-task";
import { findVisible, notFound, refused, viewer } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import { scopeReferenceRefusal } from "$capabilities/agents/api/shared/scope-references";
import { dispatchAgentTask } from "$capabilities/agents/api/shared/dispatch-agent-task";
import { agentRunnerConfiguration } from "$capabilities/agents/api/shared/runner-configuration";
import { queuedRunnerPlan } from "$capabilities/agents/api/shared/runner-plan";
import { openThread } from "$capabilities/agents/api/shared/threads";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const createTask = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateCreateTask(input);

  const model = serverModel();
  agentRunnerConfiguration(model);
  const store = model.store;
  const found = findVisible(store, scope, "personas", asked.personaId);
  if (found.kind !== "found") return notFound(asked.personaId, "persona");
  const persona = found.row;
  const scopeRefusal = scopeReferenceRefusal(store, scope.projectId, asked.scope);
  if (scopeRefusal !== undefined) {
    return refused(asked.personaId, "invalid-state", scopeRefusal);
  }
  const at = Date.now();
  const actor = viewer(scope);
  const id = store.transaction((unit) => {
    const threadId = openThread(unit, scope.projectId, "agentTask", at, {
      role: "prompt",
      author: actor,
      text: asked.instruction
    });
    const fields: RowFields<"agentTasks"> = {
      projectId: asId<"projects">(scope.projectId),
      threadId,
      title: asked.title,
      instruction: asked.instruction,
      personaId: persona._id,
      origin: { kind: "person" },
      state: "running",
      execution: { kind: "grounded" },
      ...(asked.scope === undefined ? {} : { scope: asked.scope }),
      tools: [...(asked.tools ?? persona.tools)],
      plan: queuedRunnerPlan(),
      outputs: [],
      questions: [],
      createdBy: actor,
      startedAt: at,
      revision: 1,
      updatedAt: at
    };
    return unit.create("agentTasks", fields);
  });
  dispatchAgentTask(model, id);
  return { accepted: true, id, revision: 1 };
};
