import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateRunAutomation } from "$capabilities/agents/api/run-automation/validate-run-automation";
import { findVisible, notFound, refused, viewer } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import { scopeReferenceRefusal } from "$capabilities/agents/api/shared/scope-references";
import { dispatchAgentTask } from "$capabilities/agents/api/shared/dispatch-agent-task";
import { agentRunnerConfiguration } from "$capabilities/agents/api/shared/runner-configuration";
import { queuedRunnerPlan } from "$capabilities/agents/api/shared/runner-plan";
import { openThread } from "$capabilities/agents/api/shared/threads";
import type { RunAutomationResult } from "$capabilities/agents/types/agents";

export const runAutomation = async (input: unknown): Promise<RunAutomationResult> => {
  const scope = await requireScope();
  const asked = validateRunAutomation(input);

  const model = serverModel();
  agentRunnerConfiguration(model);
  const store = model.store;
  const found = findVisible(store, scope, "automations", asked.automationId);
  if (found.kind !== "found") return notFound(asked.automationId, "automation");
  const automation = found.row;
  if (automation.instruction.trim() === "") {
    return refused(
      asked.automationId,
      "invalid-state",
      "it has no instruction yet, so there is nothing to ask",
      automation.revision
    );
  }
  const scopeRefusal = scopeReferenceRefusal(store, scope.projectId, automation.scope);
  if (scopeRefusal !== undefined) {
    return refused(automation._id, "invalid-state", scopeRefusal, automation.revision);
  }

  const at = Date.now();
  const actor = viewer(scope);
  const taskId = store.transaction((unit) => {
    const threadId = openThread(unit, scope.projectId, "agentTask", at, {
      role: "prompt",
      author: actor,
      text: automation.instruction
    });
    const fields: RowFields<"agentTasks"> = {
      projectId: asId<"projects">(scope.projectId),
      threadId,
      title: automation.name,
      instruction: automation.instruction,
      personaId: automation.personaId,
      origin: { kind: "automation", automationId: automation._id, trigger: "manual" },
      state: "running",
      execution: { kind: "grounded" },
      ...(automation.scope === undefined ? {} : { scope: automation.scope }),
      tools: [...automation.tools],
      plan: queuedRunnerPlan(),
      outputs: [],
      questions: [],
      createdBy: actor,
      startedAt: at,
      revision: 1,
      updatedAt: at
    };
    const opened = unit.create("agentTasks", fields);
    unit.update(`automations.${automation._id}.firedCount`, automation.firedCount + 1);
    unit.update(`automations.${automation._id}.lastFiredAt`, at);
    unit.update(`automations.${automation._id}.updatedAt`, at);
    return opened;
  });
  dispatchAgentTask(model, taskId);
  return { accepted: true, id: automation._id, taskId, revision: automation.revision };
};
