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
  type NamedResourceRef,
  type ScopeDraft,
  type ScopeNames,
  type ScopeOffering
} from "$representation/data/behavior/core/scope-draft";
import { admitResourceRef } from "$representation/data/behavior/core/resource";

export const resourceSets = () => readResourceSets();

export const setsIn = (answer: ReadResourceSetsResult | undefined): readonly ResourceSetItem[] =>
  answer?.sets ?? [];

export const projectResources = () => readProjectResourceIndex();

export const resourcesIn = (
  answer: ProjectResourceIndex | undefined
): readonly NamedResourceRef[] =>
  (answer?.resources ?? []).map((item) => ({
    ...admitResourceRef(item.ref, "project resource index item"),
    name: item.name,
    relativePath: item.relativePath
  }));

/** What the builder and every sentence read a set or a resource by. */
export const scopeNamesOf = (
  sets: readonly ResourceSetItem[],
  resources: readonly { readonly id: string; readonly name: string; readonly relativePath: string | null }[]
): ScopeNames => ({
  sets: new Map(sets.map((set) => [set.id, set.name])),
  resources: new Map(resources.map((resource) => [resource.id, resource.name])),
  relativePaths: new Map(
    resources.flatMap((resource) =>
      resource.relativePath === null ? [] : [[resource.id, resource.relativePath] as const]
    )
  )
});

/** What the builder is handed for a hole's default, or for an answer. */
export const offeringOf = (
  sets: readonly ResourceSetItem[],
  resources: readonly NamedResourceRef[]
): ScopeOffering => ({
  sets: sets.map((set) => ({ id: set.id, name: set.name, set: set.set })),
  resources
});

/** The words typed for each text hole, with the untouched ones left out. */
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
