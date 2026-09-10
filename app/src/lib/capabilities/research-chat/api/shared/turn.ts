import type { ServerModel } from "$runtime/server/start.server";
import type {
  ResearchTurnUnsuccessfulFields,
  TableRow
} from "$model/server/store/index.server";
import { DEFAULT_TOOLS, orderedTools } from "$representation/data/behavior/agents/tools";
import { isStoredPersona } from "$representation/data/behavior/agents/stored-rows";
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

export const DEFAULT_GRANTS = orderedTools([...DEFAULT_TOOLS]);

export const personaFor = (model: ServerModel, projectId: string, personaId: string | undefined) =>
  personaId === undefined
    ? undefined
    : rowsIn(model.store, "personas").find(
        (row) => isStoredPersona(row) && row._id === personaId && row.projectId === projectId
      );

const unsuccessfulFields = (
  turn: TableRow<"researchTurns">,
  ending: {
    readonly state: "failed" | "cancelled";
    readonly error: string;
    readonly at: number;
  }
): ResearchTurnUnsuccessfulFields => ({
  projectId: turn.projectId,
  researchThreadId: turn.researchThreadId,
  threadId: turn.threadId,
  promptMessageId: turn.promptMessageId,
  prompt: turn.prompt,
  mode: turn.mode,
  scope: turn.scope,
  tools: turn.tools,
  state: ending.state,
  ...(turn.stopRequestedAt === undefined ? {} : { stopRequestedAt: turn.stopRequestedAt }),
  blocks: [],
  queries: [],
  sources: [],
  findings: [],
  error: ending.error,
  askedAt: turn.askedAt,
  updatedAt: ending.at
});

/**
 * Replaces one running row with one complete unsuccessful lifecycle arm.
 *
 * A terminal row means the answer transaction committed before its caller saw
 * an error; it is authoritative and is never rewritten as a failure.
 */
export const finishRunningTurn = (
  model: ServerModel,
  turnId: string,
  ending: {
    readonly state: "failed" | "cancelled";
    readonly error: string;
    readonly at: number;
  }
): "finished" | "already-terminal" => model.store.transaction((unit) => {
  const turn = rowsIn(unit, "researchTurns").find((row) => row._id === turnId);
  if (turn === undefined) throw new Error(`no current Research turn has id '${turnId}'`);
  if (turn.state !== "running") return "already-terminal";
  unit.update(`researchTurns.${turnId}`, unsuccessfulFields(turn, ending));
  return "finished";
});

export const titleFrom = (question: string): string => {
  const trimmed = question.replace(/\s+/g, " ").trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}…`;
};
