import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";

/** Start the scoped resource query whose snapshot names the active subject. */
export const statusResourceNames = () => readProjectResourceIndex();
