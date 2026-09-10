import type { ReplyInput } from "$capabilities/comments/types/reply";
import {
  hasExactFields,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";

export const validateReply = (input: unknown): ReplyInput => {
  const fields = storedFields(input);
  if (fields === undefined || !hasExactFields(fields, ["threadId", "text"])) {
    throw new Error("comments/reply: an exact object is required");
  }
  const { threadId, text } = fields;
  if (!isStoredRowId(threadId, "commentThreads")) {
    throw new Error("comments/reply: threadId is required");
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("comments/reply: text is required");
  }
  return { threadId, text: text.trim() };
};
