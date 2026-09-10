import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateReadThread } from "$capabilities/research-chat/api/read-thread/validate-read-thread";
import { threadItem, turnItem } from "$capabilities/research-chat/api/shared/projection";
import { rowsIn, threadsIn, turnsIn } from "$capabilities/research-chat/api/shared/store";
import type { ReadThreadResult } from "$capabilities/research-chat/types/research-chat";

export const readThread = async (input: unknown): Promise<ReadThreadResult> => {
  const scope = await requireScope();
  const asked = validateReadThread(input);
  const model = serverModel();
  const store = model.store;
  const row = threadsIn(store, scope.projectId).find(
    (candidate) => candidate._id === asked.threadId
  );
  if (row === undefined) return null;
  const named = new Map(
    rowsIn(store, "personas")
      .filter((persona) => persona.projectId === scope.projectId)
      .map((persona) => [persona._id as string, persona.name])
  );
  return {
    thread: threadItem(store, row, (id) => named.get(id) ?? null),
    turns: turnsIn(store, scope.projectId, row._id).map((turn) =>
      turnItem(turn, (turnId) => model.operationFlights.isResearchActive(turnId))
    )
  };
};
