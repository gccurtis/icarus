import { readProjectComment } from "$capabilities/project/index.remote";

/** Start the selected discussion query only when the inspector has a thread. */
export const projectComment = (threadId: string | undefined) =>
  threadId === undefined ? undefined : readProjectComment({ threadId });
