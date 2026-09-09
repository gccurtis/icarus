import type { RemoveThreadInput } from "$capabilities/research-chat/types/research-chat";

export const validateRemoveThread = (input: unknown): RemoveThreadInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("removeThread takes an object");
  }
  const asked = input as Record<string, unknown>;
  if (typeof asked.threadId !== "string" || asked.threadId.trim() === "") {
    throw new Error("removeThread needs a threadId");
  }
  return { threadId: asked.threadId };
};
