import { Activities } from "$runtime/client/activities/definition";
import type { ActivitiesRuntime } from "$runtime/client/activities/types";
import type { WorkbenchRuntime } from "$runtime/client/workbench";

export type { ActivitiesRuntime, Activity, ActivityId } from "$runtime/client/activities/types";
export { ACTIVITIES } from "$runtime/client/activities/registry";

/** Builds one over any workbench. Tests use this directly. */
export const createActivities = (over: WorkbenchRuntime): ActivitiesRuntime =>
  new Activities(over);
