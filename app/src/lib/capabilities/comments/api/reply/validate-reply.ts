import type { ReplyInput } from "$capabilities/comments/types/reply";

export const validateReply = (input: unknown): ReplyInput => {
  if (typeof input !== "object" || input === null) {
    throw new Error("comments/reply: an object is required");
  }
  const { threadId, text } = input as { threadId?: unknown; text?: unknown };
  if (typeof threadId !== "string" || threadId.length === 0) {
    throw new Error("comments/reply: threadId is required");
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("comments/reply: text is required");
  }
  return { threadId, text: text.trim() };
};
