import { fieldsOf, idOf, only } from "$capabilities/agents/api/shared/validation";
import type { ReadPersonaInput } from "$capabilities/agents/types/agents";

export const validateReadPersona = (input: unknown): ReadPersonaInput => {
  const fields = fieldsOf(input, "read-persona");
  only(fields, ["personaId"], "read-persona");
  return { personaId: idOf(fields.personaId, "personas", "read-persona", "personaId") };
};
