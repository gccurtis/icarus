import {
  readProjectResourceIndex,
  type ProjectResourceIndex
} from "$capabilities/project-resources/index.remote";
import {
  readResourceSets,
  type ReadResourceSetsResult,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import type { TemplateAnswers } from "$capabilities/templates/index.remote";
import {
  narrowed,
  type ScopeDraft,
  type ScopeNames,
  type ScopeOffering
} from "$representation/data/behavior/core/scope-draft";

export const resourceSets = () => readResourceSets();
export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
  answer?.sets ?? [];
export const projectResources = () => readProjectResourceIndex();
export const resourcesIn = (
  answer: ProjectResourceIndex | undefined
): readonly { readonly id: string; readonly kind: string; readonly name: string }[] =>
  (answer?.resources ?? []).map((item) => ({ id: item.id, kind: item.kind, name: item.name }));
export const scopeNamesOf = (
  sets: readonly ResourceSetItem[],
  resources: readonly { readonly id: string; readonly name: string }[]
): ScopeNames => ({
  sets: new Map(sets.map((set) => [set.id, set.name])),
  resources: new Map(resources.map((resource) => [resource.id, resource.name]))
});
export const offeringOf = (
  sets: readonly ResourceSetItem[],
  resources: readonly { readonly id: string; readonly kind: string; readonly name: string }[]
): ScopeOffering => ({
  sets: sets.map((set) => ({ id: set.id, name: set.name, set: set.set })),
  resources
});
export const wordsFrom = (
  texts: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(texts).flatMap(([name, words]) =>
      words === undefined || words.trim() === "" ? [] : [[name, words] as const]
    )
  );
export const answersFrom = (
  choices: Readonly<Record<string, ScopeDraft | undefined>>
): TemplateAnswers =>
  Object.fromEntries(
    Object.entries(choices).flatMap(([name, draft]) => {
      if (draft === undefined) return [];
      const rule = narrowed(draft);
      return rule === undefined ? [] : [[name, rule] as const];
    })
  );
