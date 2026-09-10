import type { ServerModel } from "$runtime/server/start.server";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
import { DEFAULT_TOOLS, orderedTools } from "$representation/data/behavior/agents/tools";
import { isStoredPersona } from "$representation/data/behavior/agents/stored-rows";
import type { Message } from "$representation/data/types/agents/message";

import { rowsIn } from "$capabilities/research-chat/api/shared/store";

/**
 * The parts of one turn that are not the answer.
 *
 * Reading configuration, naming a chat from its first question, deciding which
 * thread part a message lands in, and repairing a turn a restart stranded.
 */
export const configuredInteger = (
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
export const configuredRounds = (model: ServerModel, key: string): number => {
  const value = model.configuration.get(key);
  if (!Number.isInteger(value) || ((value as number) < 1 && value !== -1)) {
    throw new Error(`Configuration key '${key}' must be a positive integer, or -1`);
  }
  return value as number;
};

export const configuredString = (model: ServerModel, key: string): string => {
  const value = model.configuration.get(key);
  if (typeof value !== "string" || value === "") {
    throw new Error(`Configuration key '${key}' must be a non-empty string`);
  }
  return value;
};

export const safeFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "The question could not be answered")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);

type PartTarget =
  | { readonly kind: "first" }
  | { readonly kind: "last"; readonly id: string; readonly messages: readonly Message[] };

/** Which part a message lands in, resolved before the write opens. */
export const partTarget = (model: ServerModel, threadId: string): PartTarget => {
  const parts = rowsIn(model.store, "threadParts")
    .filter((part) => part.threadId === threadId)
    .toSorted((left, right) => left.part - right.part);
  const last = parts[parts.length - 1];
  return last === undefined
    ? { kind: "first" }
    : { kind: "last", id: last._id, messages: last.messages };
};

export const append = (
  unit: StoreUnitOfWork,
  projectId: string,
  threadId: string,
  target: PartTarget,
  message: Message
): void => {
  if (target.kind === "first") {
    unit.create("threadParts", { projectId, threadId, part: 1, messages: [message] });
    return;
  }
  unit.update(`threadParts.${target.id}.messages`, [...target.messages, message]);
};

export const DEFAULT_GRANTS = orderedTools([...DEFAULT_TOOLS]);

export const personaFor = (model: ServerModel, projectId: string, personaId: string | undefined) =>
  personaId === undefined
    ? undefined
    : rowsIn(model.store, "personas").find(
        (row) => isStoredPersona(row) && row._id === personaId && row.projectId === projectId
      );

/**
 * A turn whose row says running that no process is running.
 *
 * Nothing survives a restart, so this is only ever reached after a crash or a
 * deploy. Marking it failed here rather than at startup means the recovery
 * happens where somebody is waiting for it and nowhere else.
 */
export const reclaim = (model: ServerModel, turnId: string): void => {
  const at = Date.now();
  model.store.transaction((unit) => {
    unit.update(`researchTurns.${turnId}.state`, "failed");
    unit.update(
      `researchTurns.${turnId}.error`,
      "The server restarted while this was running, so it never finished."
    );
    unit.update(`researchTurns.${turnId}.updatedAt`, at);
  });
};

export const titleFrom = (question: string): string => {
  const trimmed = question.replace(/\s+/g, " ").trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}…`;
};
