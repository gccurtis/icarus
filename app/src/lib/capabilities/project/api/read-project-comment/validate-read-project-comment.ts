import type { ReadProjectCommentInput } from "$capabilities/project/types/project";
import { projectInput, projectRowId } from "$capabilities/project/api/shared/input";

export const validateReadProjectComment = (input: unknown): ReadProjectCommentInput => {
  const message = "project/read-project-comment: only one exact current commentThreads id is accepted";
  const asked = projectInput(input, ["threadId"], message);
  return { threadId: projectRowId(asked.threadId, "commentThreads", message) };
};
