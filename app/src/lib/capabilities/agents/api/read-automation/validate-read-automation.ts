import { fieldsOf, idOf, only } from "$capabilities/agents/api/shared/validation";
import type { ReadAutomationInput } from "$capabilities/agents/types/agents";

export const validateReadAutomation = (input: unknown): ReadAutomationInput => {
  const fields = fieldsOf(input, "read-automation");
  only(fields, ["automationId"], "read-automation");
  return { automationId: idOf(fields.automationId, "read-automation", "automationId") };
};
