import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateReadAutomation } from "$capabilities/agents/api/read-automation/validate-read-automation";
import { findVisible } from "$capabilities/agents/api/shared/lookup";
import { automationDetail } from "$capabilities/agents/api/shared/projection";
import type { ReadAutomationResult } from "$capabilities/agents/types/agents";

export const readAutomation = async (input: unknown): Promise<ReadAutomationResult> => {
  const scope = await requireScope();
  const asked = validateReadAutomation(input);
  const found = findVisible(serverModel().store, scope, "automations", asked.automationId);
  return found.kind === "found" ? automationDetail(found.row, found.visible) : null;
};
