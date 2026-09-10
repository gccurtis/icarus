import type { ResolveThreadInput } from "$capabilities/comments/types/resolve-thread";

export const validateResolveThread = (input: unknown): ResolveThreadInput => {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    Object.keys(input).length !== 2 ||
    !Object.hasOwn(input, "threadId") ||
    !Object.hasOwn(input, "resolved")
  ) {
    throw new Error("comments/resolve-thread: an exact object is required");
  }
  const { threadId, resolved } = input as { threadId?: unknown; resolved?: unknown };
  if (typeof threadId !== "string" || threadId.length === 0 || threadId !== threadId.trim() || /[.\s]/.test(threadId)) {
    throw new Error("comments/resolve-thread: threadId is required");
  }
  if (typeof resolved !== "boolean") {
    throw new Error("comments/resolve-thread: resolved must be true or false");
  }
  return { threadId, resolved };
};
