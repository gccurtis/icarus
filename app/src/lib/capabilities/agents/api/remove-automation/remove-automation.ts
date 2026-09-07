import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateRemoveAutomation } from "$capabilities/agents/api/remove-automation/validate-remove-automation";
import { findVisible, notFound, refused, stale } from "$capabilities/agents/api/shared/lookup";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const removeAutomation = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateRemoveAutomation(input);

  const store = serverModel().store;
  const found = findVisible(store, scope, "automations", asked.automationId);
  if (found.kind !== "found") return notFound(asked.automationId, "automation");
  const automation = found.row;
  if (automation.revision !== asked.baseRevision) {
    return stale(asked.automationId, asked.baseRevision, automation.revision);
  }
  const fired = found.visible.tasks.filter(
    (task) => task.origin.kind === "automation" && task.origin.automationId === automation._id
  ).length;
  if (fired > 0) {
    return refused(
      asked.automationId,
      "in-use",
      `it fired ${fired} ${fired === 1 ? "task" : "tasks"} that still name it; switch it off instead`,
      automation.revision
    );
  }
  store.remove(`automations.${automation._id}`);
  return { accepted: true, id: automation._id, revision: automation.revision };
};
