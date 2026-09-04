import { kindMatches } from "$representation/data/behavior/core/resource";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";

export type ResourceSetLookup = (id: Id<"resourceSets">) => ResourceSet | undefined;

const sameResource = (left: ResourceRef, right: ResourceRef): boolean =>
  left.kind === right.kind && left.id === right.id;

const termMatches = (
  ref: ResourceRef,
  term: SetTerm,
  lookup: ResourceSetLookup,
  path: Set<string>
): boolean => {
  if (term.select === "project") return true;
  if (term.select === "kinds") return term.kinds.some((kind) => kindMatches(kind, ref.kind));
  if (term.select === "resources") return term.refs.some((candidate) => sameResource(candidate, ref));

  if (path.has(term.setId)) throw new Error(`resource set cycle reaches '${term.setId}'`);
  const nested = lookup(term.setId);
  if (nested === undefined) throw new Error(`resource set '${term.setId}' does not exist`);
  const next = new Set(path);
  next.add(term.setId);
  return setMatches(ref, nested, lookup, next);
};

const setMatches = (
  ref: ResourceRef,
  set: ResourceSet,
  lookup: ResourceSetLookup,
  path: Set<string>
): boolean => {
  // Semantic query's empty include means the whole project, per its contract.
  const included =
    set.include.length === 0 || set.include.some((term) => termMatches(ref, term, lookup, path));
  return included && !set.exclude.some((term) => termMatches(ref, term, lookup, path));
};

export const resourceInScope = (
  ref: ResourceRef,
  scope: ResourceSet,
  lookup: ResourceSetLookup
): boolean => setMatches(ref, scope, lookup, new Set());
