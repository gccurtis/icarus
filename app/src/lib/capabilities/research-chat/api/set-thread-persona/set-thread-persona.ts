import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateSetThreadPersona } from "$capabilities/research-chat/api/set-thread-persona/validate-set-thread-persona";
import { rowsIn, threadsIn } from "$capabilities/research-chat/api/shared/store";
import type { RemoveThreadResult } from "$capabilities/research-chat/types/research-chat";

/**
 * Who this chat answers as, from now on.
 *
 * Past turns keep the prompt they were answered under; a turn already records
 * what it was run with, so changing the chat never rewrites what was said.
 */
export const setThreadPersona = async (input: unknown): Promise<RemoveThreadResult> => {
  const scope = await requireScope();
  const asked = validateSetThreadPersona(input);
  const store = serverModel().store;

  const thread = threadsIn(store, scope.projectId).find((row) => row._id === asked.threadId);
  if (thread === undefined) {
    return { accepted: false, threadId: asked.threadId, detail: "no chat in this project has that id" };
  }
  if (asked.personaId !== null) {
    const persona = rowsIn(store, "personas").find(
      (row) => row._id === asked.personaId && row.projectId === scope.projectId
    );
    if (persona === undefined) {
      return { accepted: false, threadId: asked.threadId, detail: "no persona in this project has that id" };
    }
    store.transaction((unit) => {
      unit.update(`researchThreads.${thread._id}.personaId`, persona._id);
      unit.update(`researchThreads.${thread._id}.updatedAt`, Date.now());
    });
  } else {
    store.transaction((unit) => {
      unit.remove(`researchThreads.${thread._id}.personaId`);
      unit.update(`researchThreads.${thread._id}.updatedAt`, Date.now());
    });
  }
  return { accepted: true, threadId: thread._id };
};
