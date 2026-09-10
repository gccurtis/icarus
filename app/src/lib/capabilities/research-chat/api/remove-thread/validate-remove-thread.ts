import type { RemoveThreadInput } from "$capabilities/research-chat/types/research-chat";
import {
  currentRowId,
  exactCommandInput
} from "$capabilities/research-chat/api/shared/validation";

export const validateRemoveThread = (input: unknown): RemoveThreadInput => {
  const asked = exactCommandInput(input, ["threadId"], [], "removeThread");
  return {
    threadId: currentRowId(asked.threadId, "researchThreads", "removeThread")
  };
};
