import { fieldsOf, idOf, only, revisionOf } from "$capabilities/agents/api/shared/validation";
import type { RemovePersonaInput } from "$capabilities/agents/types/agents";

export const validateRemovePersona = (input: unknown): RemovePersonaInput => {
  const fields = fieldsOf(input, "remove-persona");
  only(fields, ["personaId", "baseRevision"], "remove-persona");
  return {
    personaId: idOf(fields.personaId, "personas", "remove-persona", "personaId"),
    baseRevision: revisionOf(fields.baseRevision, "remove-persona")
  };
};
