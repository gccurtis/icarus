import type { ReadThreadInput } from "$capabilities/research-chat/types/research-chat";
import {
  currentRowId,
  exactCommandInput
} from "$capabilities/research-chat/api/shared/validation";

export const validateReadThread = (input: unknown): ReadThreadInput => {
  const asked = exactCommandInput(input, ["threadId"], [], "readThread");
  return {
    threadId: currentRowId(asked.threadId, "researchThreads", "readThread")
  };
};
