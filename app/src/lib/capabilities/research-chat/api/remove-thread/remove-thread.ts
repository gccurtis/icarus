import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateRemoveThread } from "$capabilities/research-chat/api/remove-thread/validate-remove-thread";
import { rowsIn, threadsIn, turnsIn } from "$capabilities/research-chat/api/shared/store";
import type { RemoveThreadResult } from "$capabilities/research-chat/types/research-chat";

export const removeThread = async (input: unknown): Promise<RemoveThreadResult> => {
  const scope = await requireScope();
  const asked = validateRemoveThread(input);
  const store = serverModel().store;
  const thread = threadsIn(store, scope.projectId).find((row) => row._id === asked.threadId);
  if (thread === undefined) {
    return { accepted: false, threadId: asked.threadId, detail: "no chat in this project has that id" };
  }
  const turns = turnsIn(store, scope.projectId, thread._id);
  if (turns.some((turn) => turn.state === "running" || turn.state === "queued")) {
    return { accepted: false, threadId: asked.threadId, detail: "it is still answering" };
  }
  const partIds = rowsIn(store, "threadParts")
    .filter((part) => part.threadId === thread.threadId)
    .map((part) => part._id);
  store.transaction((unit) => {
    unit.removeRows(
      "researchTurns",
      turns.map((turn) => turn._id)
    );
    unit.removeRows("threadParts", partIds);
    unit.removeRows("threads", [thread.threadId]);
    unit.removeRows("researchThreads", [thread._id]);
  });
  return { accepted: true, threadId: thread._id };
};
