import { readProjectPerson } from "$capabilities/project/index.remote";

/** Start the selected member query only when the general lens has a subject. */
export const projectPerson = (userId: string | undefined) =>
  userId === undefined ? undefined : readProjectPerson({ userId });
