export type {
  ContextId,
  Inspection,
  InspectionNode,
  Panels,
  ResourceKind,
  ResourceRef,
  Tab,
  TabId,
  TabOptions,
  WorkbenchModel
} from "$model/client/workbench/types";
export {
  CONTEXTS_BY_KIND,
  CONTEXT_IDS,
  DEFAULTS,
  PROJECT_OVERVIEW,
  RESOURCE_KINDS,
  isContextId,
  isResourceKind
} from "$model/client/workbench/types";
export { createWorkbench } from "$model/client/workbench/constructor";
