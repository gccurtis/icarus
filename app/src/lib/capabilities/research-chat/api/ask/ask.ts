import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { textMessage } from "$representation/data/behavior/agents/messages";
import { orderedTools } from "$representation/data/behavior/agents/tools";
import type { Id } from "$representation/data/types/core/id";

import { validateAsk } from "$capabilities/research-chat/api/ask/validate-ask";
import { answerQuestion } from "$capabilities/research-chat/api/shared/answer";
import { personaPrompt } from "$capabilities/research-chat/api/shared/prompts";
import {
  abandonAfter,
  beginFlight,
  endFlight,
  isStranded
} from "$capabilities/research-chat/api/shared/flights";
import { prepareOverlay } from "$capabilities/research-chat/api/shared/overlay";
import { rowsIn, threadsIn, turnsIn, uniqueId, viewer } from "$capabilities/research-chat/api/shared/store";
import {
  DEFAULT_GRANTS,
  append,
  configuredInteger,
  configuredRounds,
  configuredString,
  partTarget,
  personaFor,
  reclaim,
  safeFailure,
  titleFrom
} from "$capabilities/research-chat/api/shared/turn";
import type { AskResult } from "$capabilities/research-chat/types/research-chat";

export const ask = async (input: unknown): Promise<AskResult> => {
  const scope = await requireScope();
  const asked = validateAsk(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;

  const thread = threadsIn(model.store, projectId).find((row) => row._id === asked.threadId);
  if (thread === undefined) {
    return {
      accepted: false,
      threadId: asked.threadId,
      reason: "not-found",
      detail: "no chat in this project has that id"
    };
  }
  const running = turnsIn(model.store, projectId, thread._id).find(
    (turn) => turn.state === "queued" || turn.state === "running"
  );
  if (running !== undefined && !isStranded(running._id)) {
    return {
      accepted: false,
      threadId: asked.threadId,
      reason: "invalid-state",
      detail: "this chat is still working on the last question"
    };
  }
  if (running !== undefined) {
    reclaim(model, running._id);
    model.observability.logger.warn("researchChat.reclaimed", {
      projectId,
      threadId: thread._id,
      turnId: running._id
    });
  }

  const persona = personaFor(model, projectId, thread.personaId);
  if (thread.personaId !== undefined && persona === undefined) {
    return {
      accepted: false,
      threadId: asked.threadId,
      reason: "not-found",
      detail: "the persona this chat answers as is not in this project any more"
    };
  }
  const grants = persona === undefined ? DEFAULT_GRANTS : orderedTools(persona.tools ?? []);
  if (!grants.includes("retrieve") && !grants.includes("resource.read")) {
    return {
      accepted: false,
      threadId: asked.threadId,
      reason: "invalid-state",
      detail: `${persona?.name ?? "This chat"} may not read the project, so it has nothing to answer from`
    };
  }

  const at = Date.now();
  const prompt = textMessage(`m-${uniqueId()}`, "prompt", viewer(scope), at, asked.text);
  const promptTarget = partTarget(model, thread.threadId);

  const turnId = model.store.transaction((unit) => {
    append(unit, projectId, thread.threadId, promptTarget, prompt);
    const opened = unit.create("researchTurns", {
      projectId,
      researchThreadId: thread._id,
      threadId: thread.threadId,
      promptMessageId: prompt.id,
      prompt: asked.text,
      mode: thread.mode,
      scope: asked.scope ?? { kind: "project" },
      tools: asked.tools ?? [],
      state: "running",
      blocks: [],
      queries: [],
      sources: [],
      findings: [],
      askedAt: at,
      updatedAt: at
    });
    if (thread.title === "New chat") {
      unit.update(`researchThreads.${thread._id}.title`, titleFrom(asked.text));
    }
    unit.update(`researchThreads.${thread._id}.updatedAt`, at);
    return opened;
  });

  const history = turnsIn(model.store, projectId, thread._id)
    .filter((turn) => turn._id !== turnId && turn.state === "answered")
    .slice(-4)
    .map((turn) => ({
      asked: turn.prompt,
      answered: turn.blocks
        .flatMap((block) => (block.type === "text" ? [block.display] : []))
        .join(" ")
        .slice(0, 600)
    }));

  const flight = beginFlight(turnId);
  const disarm = abandonAfter(
    flight,
    configuredInteger(model, "intelligence.chat.deadlineMs", { min: 1_000, max: 3_600_000 })
  );
  try {
    await prepareOverlay(model, projectId);
    const answer = await answerQuestion({
      model,
      projectId,
      scope: asked.scope ?? { kind: "project" },
      question: asked.text,
      history,
      topK: configuredInteger(model, "intelligence.chat.topK", { min: 1, max: 20 }),
      maxSources: configuredInteger(model, "intelligence.chat.maxSources", { min: 1, max: 40 }),
      chatModel: configuredString(model, "intelligence.chat.model"),
      maxToolRounds: configuredRounds(model, "intelligence.chat.maxToolRounds"),
      ...(persona === undefined ? {} : { persona: personaPrompt(persona) }),
      ...(persona?.scope === undefined ? {} : { bound: persona.scope }),
      grants,
      stopping: () => flight.stopping,
      signal: flight.controller.signal
    });

    const answeredAt = Date.now();
    const response = textMessage(
      `m-${uniqueId()}`,
      "response",
      { kind: "system" },
      answeredAt,
      answer.blocks
        .flatMap((block) => (block.type === "text" ? [block.display] : []))
        .join("\n\n")
    );
    const responseTarget = partTarget(model, thread.threadId);
    const stopped = rowsIn(model.store, "researchTurns").find((row) => row._id === turnId)
      ?.stopRequestedAt;
    model.store.transaction((unit) => {
      append(unit, projectId, thread.threadId, responseTarget, response);
      unit.update(`researchTurns.${turnId}`, {
        projectId,
        researchThreadId: thread._id,
        threadId: thread.threadId,
        promptMessageId: prompt.id,
        messageId: response.id,
        prompt: asked.text,
        mode: thread.mode,
        scope: asked.scope ?? { kind: "project" },
        tools: asked.tools ?? [],
        state: answer.status,
        ...(stopped === undefined ? {} : { stopRequestedAt: stopped }),
        blocks: answer.blocks,
        queries: answer.queries,
        sources: answer.sources,
        findings: answer.findings,
        usage: answer.usage,
        model: answer.model,
        askedAt: at,
        answeredAt,
        updatedAt: answeredAt
      });
      unit.update(`researchThreads.${thread._id}.updatedAt`, answeredAt);
    });

    model.observability.logger.info("researchChat.answered", {
      projectId,
      threadId: thread._id,
      turnId,
      state: answer.status,
      queries: answer.queries.length,
      returned: answer.returned,
      said: answer.said,
      offered: answer.offered,
      repaired: answer.repaired,
      sources: answer.sources.length,
      tokens: answer.usage.totalTokens
    });
    return { accepted: true, threadId: thread._id, turnId };
  } catch (error) {
    const failedAt = Date.now();
    const abandoned = flight.controller.signal.aborted;
    const ranOut = flight.reason === "deadline";
    model.store.transaction((unit) => {
      unit.update(`researchTurns.${turnId}.state`, abandoned && !ranOut ? "cancelled" : "failed");
      unit.update(
        `researchTurns.${turnId}.error`,
        ranOut
          ? "It ran past the time a turn is given and was stopped."
          : abandoned
            ? "Cancelled before it answered."
            : safeFailure(error)
      );
      unit.update(`researchTurns.${turnId}.updatedAt`, failedAt);
    });
    model.observability.logger.warn("researchChat.failed", {
      projectId,
      threadId: thread._id,
      turnId,
      cancelled: abandoned,
      reason: abandoned ? "cancelled" : safeFailure(error)
    });
    return { accepted: true, threadId: thread._id, turnId };
  } finally {
    disarm();
    endFlight(turnId);
  }
};
