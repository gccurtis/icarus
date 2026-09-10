import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { ConversationAggregateError } from "$representation/data/behavior/agents/conversation";
import { asId } from "$representation/data/behavior/core/id";

import { validateRemoveThread } from "$capabilities/research-chat/api/remove-thread/validate-remove-thread";
import { researchConversationIn } from "$capabilities/research-chat/api/shared/conversation";
import { threadsIn, turnsIn } from "$capabilities/research-chat/api/shared/store";
import type { RemoveThreadResult } from "$capabilities/research-chat/types/research-chat";

export const removeThread = async (input: unknown): Promise<RemoveThreadResult> => {
  const scope = await requireScope();
  const asked = validateRemoveThread(input);
  const store = serverModel().store;
  const projectId = asId<"projects">(scope.projectId);
  try {
    return store.transaction((unit): RemoveThreadResult => {
      const thread = threadsIn(unit, projectId).find((row) => row._id === asked.threadId);
      if (thread === undefined) {
        return {
          accepted: false,
          threadId: asked.threadId,
          detail: "no chat in this project has that id"
        };
      }
      const conversation = researchConversationIn(unit, projectId, thread);
      const turns = turnsIn(unit, projectId, thread._id);
      if (turns.some((turn) => turn.state === "running")) {
        return { accepted: false, threadId: asked.threadId, detail: "it is still answering" };
      }
      unit.removeRows(
        "researchTurns",
        turns.map((turn) => turn._id)
      );
      unit.removeRows("threadParts", conversation.parts.map((part) => part._id));
      unit.removeRows("threads", [conversation.thread._id]);
      unit.removeRows("researchThreads", [thread._id]);
      return { accepted: true, threadId: thread._id };
    });
  } catch (error) {
    if (!(error instanceof ConversationAggregateError)) throw error;
    return {
      accepted: false,
      threadId: asked.threadId,
      detail: "this chat is not one conversation wholly owned by this project"
    };
  }
};
