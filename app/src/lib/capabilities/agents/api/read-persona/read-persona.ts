import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateReadPersona } from "$capabilities/agents/api/read-persona/validate-read-persona";
import { findVisible } from "$capabilities/agents/api/shared/lookup";
import { personaDetail } from "$capabilities/agents/api/shared/projection";
import type { ReadPersonaResult } from "$capabilities/agents/types/agents";

export const readPersona = async (input: unknown): Promise<ReadPersonaResult> => {
  const scope = await requireScope();
  const asked = validateReadPersona(input);
  const found = findVisible(serverModel().store, scope, "personas", asked.personaId);
  return found.kind === "found" ? personaDetail(found.row, found.visible) : null;
};
