import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { DEFAULT_TOOLS } from "$representation/data/behavior/agents/tools";

import { validateCreatePersona } from "$capabilities/agents/api/create-persona/validate-create-persona";
import { viewer } from "$capabilities/agents/api/shared/lookup";
import type { RowFields } from "$capabilities/agents/api/shared/store";
import { emptyDefinition } from "$capabilities/agents/api/shared/validation";
import type { Accepted } from "$capabilities/agents/types/agents";

export const createPersona = async (input: unknown): Promise<Accepted> => {
  const scope = await requireScope();
  const asked = validateCreatePersona(input);

  const store = serverModel().store;
  const fields: RowFields<"personas"> = {
    projectId: asId<"projects">(scope.projectId),
    name: asked.name,
    ...(asked.description === undefined ? {} : { description: asked.description }),
    definition: emptyDefinition(),
    scope: { include: [{ select: "project" }], exclude: [] },
    tools: [...DEFAULT_TOOLS],
    createdBy: viewer(scope),
    revision: 1,
    updatedAt: Date.now()
  };
  const id = store.create("personas", fields);
  return { accepted: true, id, revision: 1 };
};
