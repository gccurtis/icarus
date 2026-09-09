import { readProjectResource } from "$capabilities/project/index.remote";

/** Start the selected resource query only when the inspector has a subject. */
export const projectResource = (resourceId: string | undefined) =>
  resourceId === undefined ? undefined : readProjectResource({ resourceId });
