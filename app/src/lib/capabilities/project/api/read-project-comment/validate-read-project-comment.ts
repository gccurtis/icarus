import type { ReadProjectCommentInput } from "$capabilities/project/types/project";

export const validateReadProjectComment = (input: unknown): ReadProjectCommentInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("project/read-project-comment: an object is required");
  }
  const asked = input as Record<string, unknown>;
  if (Object.keys(asked).length !== 1 || typeof asked.threadId !== "string") {
    throw new Error("project/read-project-comment: only threadId is accepted");
  }
  if (asked.threadId.length === 0 || asked.threadId.length > 500) {
    throw new Error("project/read-project-comment: threadId is required and bounded");
  }
  return { threadId: asked.threadId };
};
