import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateStopTurn } from "$capabilities/research-chat/api/stop-turn/validate-stop-turn";
import { researchConversationIn } from "$capabilities/research-chat/api/shared/conversation";
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
  const projectId = asId<"projects">(scope.projectId);

  const thread = threadsIn(model.store, projectId).find(
    (row) => row._id === asked.threadId
  );
  if (thread === undefined) {
    return {
      accepted: false,
      threadId: asked.threadId,
      detail: "no chat in this project has that id"
    };
  }
  researchConversationIn(model.store, projectId, thread);

  const turn = turnsIn(model.store, projectId, thread._id).find(
    (row) => row.state === "running"
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
    const stoppedAt = Date.now();
    model.store.update(`researchTurns.${turn._id}`, {
      projectId: turn.projectId,
      researchThreadId: turn.researchThreadId,
      threadId: turn.threadId,
      promptMessageId: turn.promptMessageId,
      prompt: turn.prompt,
      mode: turn.mode,
      scope: turn.scope,
      tools: turn.tools,
      state: "running",
      stopRequestedAt: stoppedAt,
      blocks: [],
      queries: [],
      sources: [],
      findings: [],
      askedAt: turn.askedAt,
      updatedAt: stoppedAt
    });
    return { accepted: true, threadId: thread._id, turnId: turn._id, outcome: "answering" };
  }
  return { accepted: true, threadId: thread._id, turnId: turn._id, outcome: "cancelled" };
};
