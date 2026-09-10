import { readProjectHistory } from "$capabilities/project/index.remote";

/** Start the exact activity query used by the Project Overview board. */
export const boardHistory = () =>
  readProjectHistory({ search: "", since: null, before: null, limit: 100 });
