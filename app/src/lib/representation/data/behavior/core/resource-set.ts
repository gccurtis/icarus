import { kindMatches } from "$representation/data/behavior/core/resource";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";

const keyOf = (ref: ResourceRef): string => `${ref.kind}\u0000${ref.id}`;

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
