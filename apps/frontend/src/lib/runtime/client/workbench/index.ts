import type { ClientStorage } from "$runtime/client/storage";
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
