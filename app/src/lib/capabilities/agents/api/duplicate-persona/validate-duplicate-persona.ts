import { fieldsOf, idOf, only } from "$capabilities/agents/api/shared/validation";
import type { DuplicatePersonaInput } from "$capabilities/agents/types/agents";

export const validateDuplicatePersona = (input: unknown): DuplicatePersonaInput => {
  const fields = fieldsOf(input, "duplicate-persona");
  only(fields, ["personaId"], "duplicate-persona");
  return { personaId: idOf(fields.personaId, "personas", "duplicate-persona", "personaId") };
};
