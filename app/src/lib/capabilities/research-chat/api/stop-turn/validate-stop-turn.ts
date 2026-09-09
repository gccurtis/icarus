import type { StopTurnInput } from "$capabilities/research-chat/types/research-chat";

export const validateStopTurn = (input: unknown): StopTurnInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("stopTurn takes an object");
  }
  const asked = input as Record<string, unknown>;
  if (typeof asked.threadId !== "string" || asked.threadId.trim() === "") {
    throw new Error("stopTurn needs a threadId");
  }
  return { threadId: asked.threadId };
};
