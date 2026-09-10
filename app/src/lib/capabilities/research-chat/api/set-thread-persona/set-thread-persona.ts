import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { ConversationAggregateError } from "$representation/data/behavior/agents/conversation";
import { asId } from "$representation/data/behavior/core/id";

import { validateSetThreadPersona } from "$capabilities/research-chat/api/set-thread-persona/validate-set-thread-persona";
import { researchConversationIn } from "$capabilities/research-chat/api/shared/conversation";
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
  const projectId = asId<"projects">(scope.projectId);

  const thread = threadsIn(store, projectId).find((row) => row._id === asked.threadId);
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
      const current = threadsIn(unit, projectId).find((row) => row._id === thread._id);
      if (current === undefined) {
        throw new ConversationAggregateError("The Research conversation changed before its persona update");
      }
      researchConversationIn(unit, projectId, current);
      unit.update(`researchThreads.${current._id}.personaId`, persona._id);
      unit.update(`researchThreads.${current._id}.updatedAt`, Date.now());
    });
  } else {
    store.transaction((unit) => {
      const current = threadsIn(unit, projectId).find((row) => row._id === thread._id);
      if (current === undefined) {
        throw new ConversationAggregateError("The Research conversation changed before its persona update");
      }
      researchConversationIn(unit, projectId, current);
      unit.remove(`researchThreads.${current._id}.personaId`);
      unit.update(`researchThreads.${current._id}.updatedAt`, Date.now());
    });
  }
  return { accepted: true, threadId: thread._id };
};
