import { readProjectOverview } from "$capabilities/project/index.remote";

/** Start the project metadata query used by the overview context panel. */
export const projectOverview = () => readProjectOverview();
