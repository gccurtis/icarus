import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef, ResourceSelectorKind } from "$representation/data/types/core/resource";

type ProjectTerm = { select: "project" };

type KindsTerm = { select: "kinds"; kinds: ResourceSelectorKind[] };

type NamedSetTerm = { select: "set"; setId: Id<"resourceSets"> };

export type SetTerm =
  | ProjectTerm
  | KindsTerm
  | { select: "resources"; refs: ResourceRef[] }
  | NamedSetTerm;

export type TemplatedTerm = ProjectTerm | KindsTerm | NamedSetTerm | { select: "hole"; name: string };

export type ResourceSet = { include: SetTerm[]; exclude: SetTerm[] };

export type TemplatedResourceSet = { include: TemplatedTerm[]; exclude: TemplatedTerm[] };

/**
 * What a stored set exists for, when it exists for one thing.
 *
 * A row with a name is a project subject: people make it, list it, and reuse it.
 * A row with an owner is a value something else holds, written because the rule
 * could not be said inline. It is never listed and never named, and it goes when
 * its owner goes.
 */
export type BoundTo =
  | { kind: "hole"; templateId: Id<"templates">; hole: string }
  | { kind: "resource"; ref: ResourceRef; hole: string };
