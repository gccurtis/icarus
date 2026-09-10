import { kindMatches } from "$representation/data/behavior/core/resource";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";

const keyOf = (ref: ResourceRef): string => `${ref.kind}\u0000${ref.id}`;

/**
 * Whether a resource-set row carries the ownership shape of a reusable subject.
 *
 * Unnamed rows are private storage owned by another subject. A generic scope
 * resolver must use `admittedReusableResourceSets`, not this discriminator:
 * only the former proves the complete stored row and unique id. An owning
 * capability may inspect this shape while separately proving `boundTo`.
 */
export const isReusableResourceSetRow = (
  row: { readonly name?: unknown; readonly boundTo?: unknown }
): row is { readonly name: string; readonly boundTo?: undefined } =>
  typeof row.name === "string" &&
  row.name.length > 0 &&
  row.name === row.name.trim() &&
  row.boundTo === undefined;

export type ResourceSetReferenceIssue = {
  readonly kind: "unavailable" | "cycle";
  readonly setId: string;
};

/** Finds the first reference a closed reusable-set graph cannot safely follow. */
export const resourceSetReferenceIssue = (
  set: ResourceSet,
  setsById: ReadonlyMap<string, ResourceSet>,
  selfId?: string
): ResourceSetReferenceIssue | undefined => {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const walk = (held: ResourceSet): ResourceSetReferenceIssue | undefined => {
    for (const term of [...held.include, ...held.exclude]) {
      if (term.select !== "set") continue;
      if (term.setId === selfId || visiting.has(term.setId)) {
        return { kind: "cycle", setId: term.setId };
      }
      if (visited.has(term.setId)) continue;
      const nested = setsById.get(term.setId);
      if (nested === undefined) return { kind: "unavailable", setId: term.setId };
      visiting.add(term.setId);
      const issue = walk(nested);
      visiting.delete(term.setId);
      if (issue !== undefined) return issue;
      visited.add(term.setId);
    }
    return undefined;
  };
  return walk(set);
};

export const resolveResourceSet = (
  set: ResourceSet,
  catalogue: readonly ResourceRef[],
  setsById: ReadonlyMap<string, ResourceSet> = new Map()
): readonly ResourceRef[] => {
  const known = new Map(catalogue.map((ref) => [keyOf(ref), ref]));

  const ofTerm = (term: SetTerm, seen: ReadonlySet<string>): readonly ResourceRef[] => {
    if (term.select === "project") return catalogue;
    if (term.select === "kinds") {
      return catalogue.filter((ref) => term.kinds.some((kind) => kindMatches(kind, ref.kind)));
    }
    if (term.select === "resources") {
      return term.refs.flatMap((ref) => {
        const held = known.get(keyOf(ref));
        return held === undefined ? [] : [held];
      });
    }
    if (seen.has(term.setId)) return [];
    const named = setsById.get(term.setId);
    return named === undefined ? [] : ofSet(named, new Set([...seen, term.setId]));
  };

  const union = (terms: readonly SetTerm[], seen: ReadonlySet<string>): Map<string, ResourceRef> => {
    const found = new Map<string, ResourceRef>();
    for (const term of terms) {
      for (const ref of ofTerm(term, seen)) found.set(keyOf(ref), ref);
    }
    return found;
  };

  const ofSet = (held: ResourceSet, seen: ReadonlySet<string>): readonly ResourceRef[] => {
    const included = union(held.include, seen);
    const excluded = union(held.exclude, seen);
    return [...included].filter(([key]) => !excluded.has(key)).map(([, ref]) => ref);
  };

  return ofSet(set, new Set());
};
