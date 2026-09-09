import type { ReadThreadInput } from "$capabilities/research-chat/types/research-chat";

export const validateReadThread = (input: unknown): ReadThreadInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("readThread takes an object");
  }
  const asked = input as Record<string, unknown>;
  if (typeof asked.threadId !== "string" || asked.threadId.trim() === "") {
    throw new Error("readThread needs a threadId");
  }
  return { threadId: asked.threadId };
};
