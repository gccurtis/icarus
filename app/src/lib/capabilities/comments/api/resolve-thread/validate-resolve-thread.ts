import type { ResolveThreadInput } from "$capabilities/comments/types/resolve-thread";
import {
  hasExactFields,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";

export const validateResolveThread = (input: unknown): ResolveThreadInput => {
  const fields = storedFields(input);
  if (fields === undefined || !hasExactFields(fields, ["threadId", "resolved"])) {
    throw new Error("comments/resolve-thread: an exact object is required");
  }
  const { threadId, resolved } = fields;
  if (!isStoredRowId(threadId, "commentThreads")) {
    throw new Error("comments/resolve-thread: threadId is required");
  }
  if (typeof resolved !== "boolean") {
    throw new Error("comments/resolve-thread: resolved must be true or false");
  }
  return { threadId, resolved };
};
