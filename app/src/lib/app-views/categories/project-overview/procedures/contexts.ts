import {
  createResourceSet as createResourceSetRemote,
  readResourceSets,
  removeResourceSet as removeResourceSetRemote,
  updateResourceSet as updateResourceSetRemote,
  type ReadResourceSetsResult,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import {
  readProjectResourceIndex,
  type ProjectResourceIndex
} from "$capabilities/project-resources/index.remote";
import type {
  ScopeNames,
  ScopeOffering
} from "$representation/data/behavior/core/scope-draft";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
export type { ResourceSet } from "$representation/data/types/core/resource-set";

export const resourceSets = () => readResourceSets();

export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
  answer?.sets ?? [];

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

/** What the builder is handed here: the other named sets, and the project. */
export const offeringOf = (
  sets: readonly ResourceSetItem[],
  resources: readonly { readonly id: string; readonly kind: string; readonly name: string }[],
  self?: string
): ScopeOffering => ({
  sets: sets.filter((set) => set.id !== self).map((set) => ({ id: set.id, name: set.name, set: set.set })),
  resources,
  ...(self === undefined ? {} : { self })
});

export const scopeNamesOf = (
  sets: readonly ResourceSetItem[],
  resources: readonly { readonly id: string; readonly name: string }[]
): ScopeNames => ({
  sets: new Map(sets.map((set) => [set.id, set.name])),
  resources: new Map(resources.map((resource) => [resource.id, resource.name]))
});

export const projectResources = () => readProjectResourceIndex();

export const resourcesIn = (
  answer: ProjectResourceIndex | undefined
): readonly { readonly id: string; readonly kind: string; readonly name: string }[] =>
  (answer?.resources ?? []).map((item) => ({ id: item.id, kind: item.kind, name: item.name }));

export const nextSetName = (sets: readonly ResourceSetItem[]): string => {
  const taken = new Set(sets.map((set) => set.name.toLocaleLowerCase()));
  let suffix = 1;
  while (taken.has(`new set ${suffix}`)) suffix += 1;
  return `New set ${suffix}`;
};

export const createSet = (view: WorkspaceStateModel, name: string, set: ResourceSet) =>
  view.singleFlight(["resource-set", view.project, "create", name.trim(), JSON.stringify(set)], () =>
    createResourceSetRemote({ name: name.trim(), set }).updates(readResourceSets)
  );

export const renameSet = (view: WorkspaceStateModel, item: ResourceSetItem, name: string) =>
  view.singleFlight(["resource-set", view.project, item.id, "rename", item.revision, name.trim()], () =>
    updateResourceSetRemote({
      setId: item.id,
      baseRevision: item.revision,
      patch: { name: name.trim() }
    }).updates(readResourceSets)
  );

export const describeSet = (view: WorkspaceStateModel, item: ResourceSetItem, description: string) =>
  view.singleFlight(
    ["resource-set", view.project, item.id, "describe", item.revision, description.trim()],
    () =>
      updateResourceSetRemote({
        setId: item.id,
        baseRevision: item.revision,
        patch: { description: description.trim() === "" ? null : description.trim() }
      }).updates(readResourceSets)
  );

export const changeSet = (view: WorkspaceStateModel, item: ResourceSetItem, set: ResourceSet) =>
  view.singleFlight(
    ["resource-set", view.project, item.id, "set", item.revision, JSON.stringify(set)],
    () =>
      updateResourceSetRemote({ setId: item.id, baseRevision: item.revision, patch: { set } }).updates(
        readResourceSets
      )
  );

export const removeSet = (view: WorkspaceStateModel, item: ResourceSetItem) =>
  view.singleFlight(["resource-set", view.project, item.id, "remove", item.revision], () =>
    removeResourceSetRemote({ setId: item.id, baseRevision: item.revision }).updates(readResourceSets)
  );
