import { browser } from "$app/environment";
import type { ActivitiesRuntime } from "$runtime/client/activities";
import { createActivities } from "$runtime/client/activities";
import type { InspectorRuntime } from "$runtime/client/inspector";
import { createInspector } from "$runtime/client/inspector";
import type { PreferencesRuntime } from "$runtime/client/preferences";
import { createPreferences } from "$runtime/client/preferences";
import type { ClientStorage } from "$runtime/client/storage";
import { createBrowserStorage } from "$runtime/client/storage";
import type { WorkbenchRuntime } from "$runtime/client/workbench";
import { createWorkbench } from "$runtime/client/workbench";

export type { ClientStorage } from "$runtime/client/storage";
export type { PreferencesRuntime, Panels } from "$runtime/client/preferences";
export type {
  WorkbenchRuntime,
  Tab,
  TabId,
  TabOptions,
  ResourceKind,
  ResourceRef,
  Inspection,
  InspectionNode
} from "$runtime/client/workbench";
export type { ActivitiesRuntime, Activity, ActivityId } from "$runtime/client/activities";
export type { InspectorRuntime, InspectorView } from "$runtime/client/inspector";

/**
 * One browser's client runtime: everything holding this user's state.
 *
 * The mirror of [`runtime/server`](../server/index.server.ts), and deliberately
 * so — same shape, learned once. The difference is only which way the guard
 * points: the server runtime holds nothing per-user and so is safe as a process
 * singleton, while these hold one user's tabs and panel widths and must not
 * exist on the server at all.
 */
export interface ClientRuntime {
  readonly storage: ClientStorage;
  readonly preferences: PreferencesRuntime;
  readonly workbench: WorkbenchRuntime;
  readonly activities: ActivitiesRuntime;
  readonly inspector: InspectorRuntime;
}

/**
 * Builds one runtime over a given storage, in dependency order.
 *
 * Storage is a parameter rather than something this reaches for, which is the
 * point of having a composition root at all: a test builds the whole graph over
 * a fake store in one call and can then assert across objects — that the
 * activities projection follows the workbench, that closing a tab moves the
 * inspection — without wiring five things by hand or reaching into any of them.
 *
 * Nothing here is `browser`-guarded. This function is pure composition and runs
 * anywhere; the guard belongs to the accessor below, so there is exactly one in
 * the tree rather than one per object.
 */
export const createClientRuntime = (storage: ClientStorage): ClientRuntime => {
  // The two stateful objects first — the projections read through them.
  const preferences = createPreferences(storage);
  const workbench = createWorkbench(storage);

  return {
    storage,
    preferences,
    workbench,
    activities: createActivities(workbench),
    inspector: createInspector(workbench)
  };
};

/**
 * The one client runtime for this browser.
 *
 * **This guard is the isolation, and it is the only one.** A module is imported
 * on the server whether or not SSR is on — SvelteKit loads a route's component
 * modules to link their CSS even when it renders only a shell — so a
 * module-level instance would be constructed once per process and shared by
 * every request in it.
 *
 * `browser` is `true` in the client bundle and `false` in the server bundle, so
 * under this guard the objects cannot be constructed on the server. Not
 * constructed-and-unread: not constructed. That is why `/app` sets
 * `ssr = false`, and why nothing else in this tree needs a guard of its own.
 *
 * See [`client.md`](client.md).
 */
let instance: ClientRuntime | undefined;

export const clientRuntime = (): ClientRuntime => {
  if (!browser) {
    throw new Error(
      "The client runtime is browser-only. A route that reads it needs `ssr = false` — " +
        "see src/lib/runtime/client/client.md."
    );
  }

  return (instance ??= createClientRuntime(createBrowserStorage()));
};
