import { fieldsOf, has, nameOf, only, optionalTextOf } from "$capabilities/agents/api/shared/validation";
import type { CreatePersonaInput } from "$capabilities/agents/types/agents";

export const validateCreatePersona = (input: unknown): CreatePersonaInput => {
  const fields = fieldsOf(input, "create-persona");
  only(fields, ["name", "description"], "create-persona");
  const description = has(fields, "description")
    ? optionalTextOf(fields.description, "create-persona", "description", 500)
    : undefined;
  return {
    name: nameOf(fields.name, "create-persona"),
    ...(description === undefined ? {} : { description })
  };
};
