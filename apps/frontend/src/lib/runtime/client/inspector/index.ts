import { Inspector } from "$runtime/client/inspector/definition";
import type { InspectorRuntime } from "$runtime/client/inspector/types";
import type { WorkbenchRuntime } from "$runtime/client/workbench";

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
