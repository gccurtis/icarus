import type { StopTurnInput } from "$capabilities/research-chat/types/research-chat";
import {
  currentRowId,
  exactCommandInput
} from "$capabilities/research-chat/api/shared/validation";

export const validateStopTurn = (input: unknown): StopTurnInput => {
  const asked = exactCommandInput(input, ["threadId"], [], "stopTurn");
  return {
    threadId: currentRowId(asked.threadId, "researchThreads", "stopTurn")
  };
};
