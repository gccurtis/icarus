export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type { ResourceSet } from "$representation/data/types/core/resource-set";

export {
  PROJECT_KINDS as KINDS,
  builderView,
  draftOf,
  isWholeProject,
  narrowed,
  ruleWords as ruleOf,
  termFor,
  withTerm,
  withWholeProject,
  withoutTerm,
  type OfferSource,
  type ScopeDraft,
  type ScopeNames,
  type ScopeSide
} from "$representation/data/behavior/core/scope-draft";

export { projectResources, resourceSets, resourcesIn, setsIn } from "$app-views/categories/project-overview/procedures/context-data";
export { nextSetName, offeringOf, scopeNamesOf } from "$app-views/categories/project-overview/procedures/context-scope";
export { createSet } from "$app-views/categories/project-overview/procedures/create-set";
export { renameSet } from "$app-views/categories/project-overview/procedures/rename-set";
export { describeSet } from "$app-views/categories/project-overview/procedures/describe-set";
export { changeSet } from "$app-views/categories/project-overview/procedures/change-set";
export { removeSet } from "$app-views/categories/project-overview/procedures/remove-set";
