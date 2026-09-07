import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateRemovePersona } from "$capabilities/agents/api/remove-persona/validate-remove-persona";
import { findVisible, notFound, refused, stale } from "$capabilities/agents/api/shared/lookup";
import type { WriteResult } from "$capabilities/agents/types/agents";

export const removePersona = async (input: unknown): Promise<WriteResult> => {
  const scope = await requireScope();
  const asked = validateRemovePersona(input);

  const store = serverModel().store;
  const found = findVisible(store, scope, "personas", asked.personaId);
  if (found.kind !== "found") return notFound(asked.personaId, "persona");
  const persona = found.row;
  if (persona.revision !== asked.baseRevision) {
    return stale(asked.personaId, asked.baseRevision, persona.revision);
  }
  const tasks = found.visible.tasks.filter((row) => row.personaId === persona._id).length;
  const automations = found.visible.automations.filter((row) => row.personaId === persona._id).length;
  const chats = found.visible.chats.filter((row) => row.personaId === persona._id).length;
  if (tasks + automations + chats > 0) {
    const parts = [
      tasks > 0 ? `${tasks} ${tasks === 1 ? "task" : "tasks"}` : undefined,
      automations > 0 ? `${automations} ${automations === 1 ? "automation" : "automations"}` : undefined,
      chats > 0 ? `${chats} ${chats === 1 ? "chat" : "chats"}` : undefined
    ].filter((part): part is string => part !== undefined);
    return refused(
      asked.personaId,
      "in-use",
      `still named by ${parts.join(", ")}`,
      persona.revision
    );
  }
  store.remove(`personas.${persona._id}`);
  return { accepted: true, id: persona._id, revision: persona.revision };
};
