import type { ResourceSetItem } from "$capabilities/resource-sets/index.remote";
import type {
  ScopeNames,
  ScopeOffering
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

export const nextSetName = (sets: readonly ResourceSetItem[]): string => {
  const taken = new Set(sets.map((set) => set.name.toLocaleLowerCase()));
  let suffix = 1;
  while (taken.has(`new set ${suffix}`)) suffix += 1;
  return `New set ${suffix}`;
};
