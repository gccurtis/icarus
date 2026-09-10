import { readComments } from "$capabilities/comments/index.remote";

/** Start the scoped comment query used by the Project Overview board. */
export const projectComments = () => readComments();
