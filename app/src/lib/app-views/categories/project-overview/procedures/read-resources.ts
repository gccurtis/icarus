import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";

/** Start the scoped resource-index query used by the Project Overview board. */
export const projectResources = () => readProjectResourceIndex();
