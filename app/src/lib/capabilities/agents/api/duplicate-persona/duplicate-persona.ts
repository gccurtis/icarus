import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateDuplicatePersona } from "$capabilities/agents/api/duplicate-persona/validate-duplicate-persona";
import { findVisible, notFound, viewer } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const duplicatePersona = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateDuplicatePersona(input);

  const store = serverModel().store;
  const found = findVisible(store, scope, "personas", asked.personaId);
  if (found.kind !== "found") return notFound(asked.personaId, "persona");
  const source = found.row;
  const taken = new Set(found.visible.personas.map((row) => row.name.toLocaleLowerCase()));
  let name = `${source.name} (copy)`;
  let suffix = 2;
  while (taken.has(name.toLocaleLowerCase())) {
    name = `${source.name} (copy ${suffix})`;
    suffix += 1;
  }
  const fields: RowFields<"personas"> = {
    projectId: asId<"projects">(scope.projectId),
    name,
    ...(source.description === undefined ? {} : { description: source.description }),
    definition: { ...source.definition },
    ...(source.scope === undefined ? {} : { scope: source.scope }),
    ...(source.cast === undefined ? {} : { cast: source.cast }),
    tools: [...source.tools],
    ...(source.avatar === undefined ? {} : { avatar: source.avatar }),
    createdBy: viewer(scope),
    revision: 1,
    updatedAt: Date.now()
  };
  const id = store.create("personas", fields);
  return { accepted: true, id, revision: 1 };
};
