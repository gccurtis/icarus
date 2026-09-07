import { fieldsOf, idOf, only, revisionOf } from "$capabilities/agents/api/shared/validation";
import type { RemoveAutomationInput } from "$capabilities/agents/types/agents";

export const validateRemoveAutomation = (input: unknown): RemoveAutomationInput => {
  const fields = fieldsOf(input, "remove-automation");
  only(fields, ["automationId", "baseRevision"], "remove-automation");
  return {
    automationId: idOf(fields.automationId, "remove-automation", "automationId"),
    baseRevision: revisionOf(fields.baseRevision, "remove-automation")
  };
};
