import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";

/** Start the scoped resource query whose snapshot names represented tabs. */
export const tabResourceNames = () => readProjectResourceIndex();
