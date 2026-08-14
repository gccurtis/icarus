import { browser } from "$app/environment";
import { Activities } from "$runtime/client/activities/definition";
import type { ActivitiesRuntime } from "$runtime/client/activities/types";
import type { WorkbenchRuntime } from "$runtime/client/workbench";
import { workbench } from "$runtime/client/workbench";

export type { ActivitiesRuntime, Activity, ActivityId } from "$runtime/client/activities/types";
export { ACTIVITIES } from "$runtime/client/activities/registry";

/** Builds one over any workbench. Tests use this directly. */
export const createActivities = (over: WorkbenchRuntime): ActivitiesRuntime =>
  new Activities(over);

let instance: ActivitiesRuntime | undefined;

/**
 * The one activities projection for this browser.
 *
 * Guarded like the objects it projects over, even though it holds no state
 * itself: it closes over a workbench, and a server-side instance would close
 * over a workbench that must not exist there either. See
 * [`client.md`](../client.md).
 */
export const activities = (): ActivitiesRuntime => {
  if (!browser) {
    throw new Error(
      "activities is browser-only. A route that reads it needs `ssr = false` — " +
        "see src/lib/runtime/client/client.md."
    );
  }

  return (instance ??= createActivities(workbench()));
};
