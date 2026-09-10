import {
  castOf,
  fieldsOf,
  has,
  idOf,
  nameOf,
  only,
  optionalTextOf,
  resourceSetOf,
  revisionOf,
  sectionOf,
  toolsOf
} from "$capabilities/agents/api/shared/validation";
import type { UpdatePersonaInput, UpdatePersonaPatch } from "$capabilities/agents/types/agents";

const SUBJECT = "update-persona";

export const validateUpdatePersona = (input: unknown): UpdatePersonaInput => {
  const fields = fieldsOf(input, SUBJECT);
  only(fields, ["personaId", "baseRevision", "patch"], SUBJECT);
  const raw = fieldsOf(fields.patch, SUBJECT);
  only(raw, ["name", "description", "section", "scope", "cast", "tools"], SUBJECT);
  if (Reflect.ownKeys(raw).length === 0) throw new Error(`agents/${SUBJECT}: the patch changes nothing`);

  const patch: UpdatePersonaPatch = {
    ...(has(raw, "name") ? { name: nameOf(raw.name, SUBJECT) } : {}),
    ...(has(raw, "description")
      ? { description: raw.description === null ? null : (optionalTextOf(raw.description, SUBJECT, "description", 500) ?? null) }
      : {}),
    ...(has(raw, "section") ? { section: sectionOf(raw.section, SUBJECT) } : {}),
    ...(has(raw, "scope") ? { scope: raw.scope === null ? null : resourceSetOf(raw.scope, SUBJECT) } : {}),
    ...(has(raw, "cast") ? { cast: raw.cast === null ? null : castOf(raw.cast, SUBJECT) } : {}),
    ...(has(raw, "tools") ? { tools: toolsOf(raw.tools, SUBJECT) } : {})
  };
  return {
    personaId: idOf(fields.personaId, "personas", SUBJECT, "personaId"),
    baseRevision: revisionOf(fields.baseRevision, SUBJECT),
    patch
  };
};
