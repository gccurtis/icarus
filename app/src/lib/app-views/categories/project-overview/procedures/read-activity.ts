import { readProjectActivity } from "$capabilities/project/index.remote";

/** Start the selected activity query only when the inspector has a subject. */
export const projectActivity = (activityId: string | undefined) =>
  activityId === undefined ? undefined : readProjectActivity({ activityId });
