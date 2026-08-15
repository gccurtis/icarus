export type {
  ActivityId,
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
  ACTIVITIES_BY_KIND,
  ACTIVITY_IDS,
  DEFAULTS,
  PROJECT_OVERVIEW,
  RESOURCE_KINDS,
  isActivityId,
  isResourceKind
} from "$model/client/workbench/types";
export { createWorkbench } from "$model/client/workbench/constructor";
