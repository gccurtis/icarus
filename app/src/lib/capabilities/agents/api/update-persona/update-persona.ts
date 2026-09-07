import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { findVisible, notFound, refused, stale } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import { validateUpdatePersona } from "$capabilities/agents/api/update-persona/validate-update-persona";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const updatePersona = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateUpdatePersona(input);

  const store = serverModel().store;
  const found = findVisible(store, scope, "personas", asked.personaId);
  if (found.kind !== "found") return notFound(asked.personaId, "persona");
  const persona = found.row;
  if (persona.revision !== asked.baseRevision) {
    return stale(asked.personaId, asked.baseRevision, persona.revision);
  }
  const patch = asked.patch;
  const { _id, _creationTime, description, scope: access, cast, ...rest } = persona;
  void _id;
  void _creationTime;
  const nextDescription =
    patch.description === undefined ? description : (patch.description ?? undefined);
  const nextScope = patch.scope === undefined ? access : (patch.scope ?? undefined);
  const nextCast = patch.cast === undefined ? cast : (patch.cast ?? undefined);
  const fields: RowFields<"personas"> = {
    ...rest,
    name: patch.name ?? persona.name,
    ...(nextDescription === undefined ? {} : { description: nextDescription }),
    definition:
      patch.section === undefined
        ? persona.definition
        : { ...persona.definition, [patch.section.name]: patch.section.text },
    ...(nextScope === undefined ? {} : { scope: nextScope }),
    ...(nextCast === undefined ? {} : { cast: nextCast }),
    tools: [...(patch.tools ?? persona.tools)],
    revision: persona.revision + 1,
    updatedAt: Date.now()
  };
  store.update(`personas.${persona._id}`, fields);
  return { accepted: true, id: persona._id, revision: fields.revision };
};
