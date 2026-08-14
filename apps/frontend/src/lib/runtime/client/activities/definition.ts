import { ACTIVITIES } from "$runtime/client/activities/registry";
import type { ActivitiesRuntime, Activity, ActivityId } from "$runtime/client/activities/types";
import type { WorkbenchRuntime } from "$runtime/client/workbench";

/**
 * A plain `.ts`, not `.svelte.ts`, because this holds **no state of its own**.
 * Every value is a projection over the workbench, and reading `$state` through a
 * getter tracks correctly wherever the read happens — so a component consuming
 * this stays reactive without this owning a single field.
 *
 * That is worth preserving. The moment this file needs `$state`, something has
 * been put in the wrong place: per-tab choices belong to the workbench, and panel
 * geometry belongs to the component that enforces the drag.
 *
 * It takes the workbench rather than importing it, which is what lets two
 * instances exist independently — and what stops this from being the file that
 * quietly reintroduces a singleton.
 */
export class Activities implements ActivitiesRuntime {
  constructor(private readonly workbench: WorkbenchRuntime) {}

  get available(): readonly Activity[] {
    return ACTIVITIES[this.workbench.active.resource.kind];
  }

  get active(): Activity {
    const available = this.available;
    const chosen = this.workbench.active.options.activityId;
    // Falling back rather than throwing: a stored id can outlive a change to the
    // activity set, and a reset rail is a harmless outcome where a crash is not.
    return available.find((activity) => activity.id === chosen) ?? available[0];
  }

  select(id: ActivityId): void {
    if (!this.available.some((activity) => activity.id === id)) {
      throw new Error(
        `Activity ${id} is not available for resource kind ${this.workbench.active.resource.kind}.`
      );
    }
    this.workbench.update(this.workbench.activeId, { activityId: id });
  }
}
