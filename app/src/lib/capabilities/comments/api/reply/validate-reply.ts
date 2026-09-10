import type { ReplyInput } from "$capabilities/comments/types/reply";

export const validateReply = (input: unknown): ReplyInput => {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    Object.keys(input).length !== 2 ||
    !Object.hasOwn(input, "threadId") ||
    !Object.hasOwn(input, "text")
  ) {
    throw new Error("comments/reply: an exact object is required");
  }
  const { threadId, text } = input as { threadId?: unknown; text?: unknown };
  if (typeof threadId !== "string" || threadId.length === 0 || threadId !== threadId.trim() || /[.\s]/.test(threadId)) {
    throw new Error("comments/reply: threadId is required");
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("comments/reply: text is required");
  }
  return { threadId, text: text.trim() };
};
