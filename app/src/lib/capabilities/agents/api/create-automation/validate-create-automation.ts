import {
  fieldsOf,
  has,
  idOf,
  nameOf,
  only,
  optionalTextOf,
  resourceSetOf,
  toolsOf,
  triggerOf
} from "$capabilities/agents/api/shared/validation";
import type { CreateAutomationInput } from "$capabilities/agents/types/agents";

const SUBJECT = "create-automation";

export const validateCreateAutomation = (input: unknown): CreateAutomationInput => {
  const fields = fieldsOf(input, SUBJECT);
  only(fields, ["personaId", "name", "instruction", "trigger", "scope", "tools"], SUBJECT);
  const instruction = has(fields, "instruction")
    ? optionalTextOf(fields.instruction, SUBJECT, "instruction", 20_000)
    : undefined;
  return {
    personaId: idOf(fields.personaId, SUBJECT, "personaId"),
    name: nameOf(fields.name, SUBJECT),
    ...(instruction === undefined ? {} : { instruction }),
    ...(has(fields, "trigger") ? { trigger: triggerOf(fields.trigger, SUBJECT) } : {}),
    ...(has(fields, "scope") ? { scope: resourceSetOf(fields.scope, SUBJECT) } : {}),
    ...(has(fields, "tools") ? { tools: toolsOf(fields.tools, SUBJECT) } : {})
  };
};
