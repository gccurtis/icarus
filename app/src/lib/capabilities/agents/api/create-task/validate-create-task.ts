import {
  fieldsOf,
  has,
  idOf,
  instructionOf,
  nameOf,
  only,
  resourceSetOf,
  toolsOf
} from "$capabilities/agents/api/shared/validation";
import type { CreateTaskInput } from "$capabilities/agents/types/agents";

const SUBJECT = "create-task";

export const validateCreateTask = (input: unknown): CreateTaskInput => {
  const fields = fieldsOf(input, SUBJECT);
  only(fields, ["personaId", "title", "instruction", "scope", "tools"], SUBJECT);
  return {
    personaId: idOf(fields.personaId, SUBJECT, "personaId"),
    title: nameOf(fields.title, SUBJECT),
    instruction: instructionOf(fields.instruction, SUBJECT),
    ...(has(fields, "scope") ? { scope: resourceSetOf(fields.scope, SUBJECT) } : {}),
    ...(has(fields, "tools") ? { tools: toolsOf(fields.tools, SUBJECT) } : {})
  };
};
