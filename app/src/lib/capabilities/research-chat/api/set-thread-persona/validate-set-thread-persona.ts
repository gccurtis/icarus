import type { SetThreadPersonaInput } from "$capabilities/research-chat/types/research-chat";
import {
  currentRowId,
  exactCommandInput
} from "$capabilities/research-chat/api/shared/validation";

export const validateSetThreadPersona = (input: unknown): SetThreadPersonaInput => {
  const asked = exactCommandInput(
    input,
    ["threadId", "personaId"],
    [],
    "setThreadPersona"
  );
  const personaId = asked.personaId === null
    ? null
    : currentRowId(asked.personaId, "personas", "setThreadPersona");
  return {
    threadId: currentRowId(asked.threadId, "researchThreads", "setThreadPersona"),
    personaId
  };
};
