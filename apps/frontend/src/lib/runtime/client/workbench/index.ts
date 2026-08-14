import { browser } from "$app/environment";
import type { ClientStorage } from "$runtime/client/storage";
import { storage } from "$runtime/client/storage";
import { Workbench } from "$runtime/client/workbench/definition.svelte";
import type { WorkbenchRuntime } from "$runtime/client/workbench/types";

export type {
  Inspection,
  InspectionNode,
  ResourceKind,
  ResourceRef,
  Tab,
  TabId,
  TabOptions,
  WorkbenchRuntime
} from "$runtime/client/workbench/types";
export {
  PROJECT_OVERVIEW,
  RESOURCE_KINDS,
  isResourceKind
} from "$runtime/client/workbench/types";

/** Builds one, over any storage. Tests use this directly with a fake. */
export const createWorkbench = (from: ClientStorage): WorkbenchRuntime =>
  new Workbench(from);

let instance: WorkbenchRuntime | undefined;

/**
 * The one workbench for this browser.
 *
 * The guard is the isolation. `browser` is `true` in the client bundle and
 * `false` in the server bundle, so on the server this cannot construct — there
 * is no instance to be shared between requests, rather than one that exists and
 * happens not to be read. See [`client.md`](../client.md).
 */
export const workbench = (): WorkbenchRuntime => {
  if (!browser) {
    throw new Error(
      "workbench is browser-only. A route that reads it needs `ssr = false` — " +
        "see src/lib/runtime/client/client.md."
    );
  }

  return (instance ??= createWorkbench(storage()));
};
