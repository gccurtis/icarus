import { browser } from "$app/environment";
import { Inspector } from "$runtime/client/inspector/definition";
import type { InspectorRuntime } from "$runtime/client/inspector/types";
import type { WorkbenchRuntime } from "$runtime/client/workbench";
import { workbench } from "$runtime/client/workbench";

export type {
  InspectorRuntime,
  InspectorView,
  InspectorViewProps
} from "$runtime/client/inspector/types";
export { INSPECTOR_VIEWS } from "$runtime/client/inspector/registry";
export { default as NothingInspected } from "$runtime/client/inspector/views/nothing.svelte";

/** Builds one over any workbench. Tests use this directly. */
export const createInspector = (over: WorkbenchRuntime): InspectorRuntime =>
  new Inspector(over);

let instance: InspectorRuntime | undefined;

/**
 * The one inspector for this browser. Guarded like the objects it projects over
 * — see [`client.md`](../client.md).
 */
export const inspector = (): InspectorRuntime => {
  if (!browser) {
    throw new Error(
      "inspector is browser-only. A route that reads it needs `ssr = false` — " +
        "see src/lib/runtime/client/client.md."
    );
  }

  return (instance ??= createInspector(workbench()));
};
