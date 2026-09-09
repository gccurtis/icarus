import type { SetThreadPersonaInput } from "$capabilities/research-chat/types/research-chat";

export const validateSetThreadPersona = (input: unknown): SetThreadPersonaInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("setThreadPersona takes an object");
  }
  const asked = input as Record<string, unknown>;
  if (typeof asked.threadId !== "string" || asked.threadId.trim() === "") {
    throw new Error("setThreadPersona needs a threadId");
  }
  if (asked.personaId !== null && typeof asked.personaId !== "string") {
    throw new Error("a personaId is a string, or null to answer as nobody");
  }
  return { threadId: asked.threadId, personaId: asked.personaId };
};
