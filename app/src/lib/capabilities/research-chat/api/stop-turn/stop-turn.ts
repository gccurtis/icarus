import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { validateStopTurn } from "$capabilities/research-chat/api/stop-turn/validate-stop-turn";
import { threadsIn, turnsIn } from "$capabilities/research-chat/api/shared/store";
import type { StopTurnResult } from "$capabilities/research-chat/types/research-chat";

/**
 * Ask the chat's running turn to finish, then to give up.
 *
 * The first ask is not a cancellation: the tools begin answering that the person
 * wants an answer now, and the model submits what it already has. A second ask
 * abandons the run, because somebody who presses twice means it.
 *
 * Addressed by chat rather than by turn: the turn a person is stopping is the
 * one being made by the request they are still waiting on, so its id has not
 * reached the browser yet.
 */
export const stopTurn = async (input: unknown): Promise<StopTurnResult> => {
  const scope = await requireScope();
  const asked = validateStopTurn(input);
  const model = serverModel();

  const thread = threadsIn(model.store, scope.projectId).find(
    (row) => row._id === asked.threadId
  );
  if (thread === undefined) {
    return {
      accepted: false,
      threadId: asked.threadId,
      detail: "no chat in this project has that id"
    };
  }

  const turn = turnsIn(model.store, scope.projectId, thread._id).find(
    (row) => row.state === "running" || row.state === "queued"
  );
  if (turn === undefined) {
    return { accepted: false, threadId: asked.threadId, detail: "nothing is running in this chat" };
  }

  const outcome = model.operationFlights.requestResearchStop(turn._id);
  if (outcome === "missing") {
    return {
      accepted: false,
      threadId: asked.threadId,
      detail: "that turn is not running here any more"
    };
  }

  if (outcome === "answering") {
    model.store.update(`researchTurns.${turn._id}.stopRequestedAt`, Date.now());
    return { accepted: true, threadId: thread._id, turnId: turn._id, outcome: "answering" };
  }
  return { accepted: true, threadId: thread._id, turnId: turn._id, outcome: "cancelled" };
};
