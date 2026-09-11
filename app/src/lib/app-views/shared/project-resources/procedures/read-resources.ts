import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";

/** Read the same scoped resource index wherever the project table is mounted. */
export const readResources = () => readProjectResourceIndex();
