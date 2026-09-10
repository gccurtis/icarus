import { fieldsOf, idOf, only } from "$capabilities/agents/api/shared/validation";
import type { RunAutomationInput } from "$capabilities/agents/types/agents";

export const validateRunAutomation = (input: unknown): RunAutomationInput => {
  const fields = fieldsOf(input, "run-automation");
  only(fields, ["automationId"], "run-automation");
  return { automationId: idOf(fields.automationId, "automations", "run-automation", "automationId") };
};
