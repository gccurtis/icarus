import type { Id } from "$representation/data/types/core/id";
import type { ResourceKind, ResourceRef } from "$representation/data/types/core/resource";

type ProjectTerm = { select: "project" };

type KindsTerm = { select: "kinds"; kinds: ResourceKind[] };

type NamedSetTerm = { select: "set"; setId: Id<"resourceSets"> };

export type SetTerm =
  | ProjectTerm
  | KindsTerm
  | { select: "resources"; refs: ResourceRef[] }
  | NamedSetTerm;

export type TemplatedTerm = ProjectTerm | KindsTerm | NamedSetTerm | { select: "variable"; name: string };

export type ResourceSet = { include: SetTerm[]; exclude: SetTerm[] };

export type TemplatedResourceSet = { include: TemplatedTerm[]; exclude: TemplatedTerm[] };
