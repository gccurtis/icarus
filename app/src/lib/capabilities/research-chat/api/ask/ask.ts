import { requireScope } from "$runtime/server/scope.server";
import { serverModel, type ServerModel } from "$runtime/server/start.server";
import { textMessage } from "$representation/data/behavior/agents/messages";
import { DEFAULT_TOOLS, orderedTools } from "$representation/data/behavior/agents/tools";
import type { Id } from "$representation/data/types/core/id";
import type { Message } from "$representation/data/types/agents/message";

import { validateAsk } from "$capabilities/research-chat/api/ask/validate-ask";
import { answerQuestion, personaPrompt } from "$capabilities/research-chat/api/shared/answer";
import {
  abandonAfter,
  beginFlight,
  endFlight,
  isStranded
} from "$capabilities/research-chat/api/shared/flights";
import { prepareOverlay } from "$capabilities/research-chat/api/shared/overlay";
import { rowsIn, threadsIn, turnsIn, uniqueId, viewer } from "$capabilities/research-chat/api/shared/store";
import type { AskResult } from "$capabilities/research-chat/types/research-chat";

const configuredInteger = (
  model: ServerModel,
  key: string,
  bounds: { min: number; max: number }
): number => {
  const value = model.configuration.get(key);
  if (!Number.isInteger(value) || (value as number) < bounds.min || (value as number) > bounds.max) {
    throw new Error(`Configuration key '${key}' must be a whole number from ${bounds.min} to ${bounds.max}`);
  }
  return value as number;
};

/** A round count, or -1 for a loop this caller does not want bounded. */
const configuredRounds = (model: ServerModel, key: string): number => {
  const value = model.configuration.get(key);
  if (!Number.isInteger(value) || ((value as number) < 1 && value !== -1)) {
    throw new Error(`Configuration key '${key}' must be a positive integer, or -1`);
  }
  return value as number;
};

const configuredString = (model: ServerModel, key: string): string => {
  const value = model.configuration.get(key);
  if (typeof value !== "string" || value === "") {
    throw new Error(`Configuration key '${key}' must be a non-empty string`);
  }
  return value;
};

const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "The question could not be answered")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

const append = (
  model: ServerModel,
  projectId: string,
  threadId: string,
  message: Message
): void => {
  const parts = rowsIn(model.store, "threadParts")
    .filter((part) => part.threadId === threadId)
    .toSorted((left, right) => left.part - right.part);
  const last = parts[parts.length - 1];
  if (last === undefined) {
    model.store.create("threadParts", { projectId, threadId, part: 1, messages: [message] });
    return;
  }
  model.store.update(`threadParts.${last._id}.messages`, [...last.messages, message]);
};

const DEFAULT_GRANTS = orderedTools([...DEFAULT_TOOLS]);

const personaFor = (model: ServerModel, projectId: string, personaId: string | undefined) =>
  personaId === undefined
    ? undefined
    : rowsIn(model.store, "personas").find(
        (row) => row._id === personaId && row.projectId === projectId
      );

/**
 * A turn whose row says running that no process is running.
 *
 * Nothing survives a restart, so this is only ever reached after a crash or a
 * deploy. Marking it failed here rather than at startup means the recovery
 * happens where somebody is waiting for it and nowhere else.
 */
const reclaim = (model: ServerModel, turnId: string): void => {
  const at = Date.now();
  model.store.update(`researchTurns.${turnId}.state`, "failed");
  model.store.update(
    `researchTurns.${turnId}.error`,
    "The server restarted while this was running, so it never finished."
  );
  model.store.update(`researchTurns.${turnId}.updatedAt`, at);
};

const titleFrom = (question: string): string => {
  const trimmed = question.replace(/\s+/g, " ").trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}…`;
};

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
  append(model, projectId, thread.threadId, prompt);

  const turnId = model.store.create("researchTurns", {
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
    model.store.update(`researchThreads.${thread._id}.title`, titleFrom(asked.text));
  }
  model.store.update(`researchThreads.${thread._id}.updatedAt`, at);

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
    append(model, projectId, thread.threadId, response);

    const stopped = rowsIn(model.store, "researchTurns").find((row) => row._id === turnId)
      ?.stopRequestedAt;
    model.store.update(`researchTurns.${turnId}`, {
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
    model.store.update(`researchThreads.${thread._id}.updatedAt`, answeredAt);

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
    model.store.update(
      `researchTurns.${turnId}.state`,
      abandoned && !ranOut ? "cancelled" : "failed"
    );
    model.store.update(
      `researchTurns.${turnId}.error`,
      ranOut
        ? "It ran past the time a turn is given and was stopped."
        : abandoned
          ? "Cancelled before it answered."
          : safeFailure(error)
    );
    model.store.update(`researchTurns.${turnId}.updatedAt`, failedAt);
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
