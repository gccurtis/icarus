import type { Id } from "$representation/data/types/core/id";
import type { ResourceKind, ResourceRef } from "$representation/data/types/core/resource";

/** Everything in this project, including whatever is made tomorrow. */
type ProjectTerm = { select: "project" };

/** Each entry is prefix-matched, so one names a whole family. */
type KindsTerm = { select: "kinds"; kinds: ResourceKind[] };

/**
 * A term bound to one project. Following a `set` reads another row, whose own
 * set may name a third.
 */
export type SetTerm =
  | ProjectTerm
  | KindsTerm
  | { select: "resources"; refs: ResourceRef[] }
  | { select: "set"; setId: Id<"resourceSets"> };

/**
 * A term a template body may hold. No ids, so it means the same in any project.
 *
 * A `variable` is a hole an answer fills at instantiation. It is a term rather
 * than a field on the set because a template may draw on several variables, and
 * a variable may be excluded as easily as included.
 */
export type TemplatedTerm = ProjectTerm | KindsTerm | { select: "variable"; name: string };

/**
 * Everything in `include`, minus everything in `exclude`.
 *
 * Two flat lists rather than a tree. What they cannot say directly — `A ∩ B`,
 * `A − (B − C)` — a named set says instead, as a `set` term.
 *
 * An empty `include` selects nothing. Checked where a set is accepted.
 */
export type ResourceSet = { include: SetTerm[]; exclude: SetTerm[] };

/** The same, as a template carries it between projects. */
export type TemplatedResourceSet = { include: TemplatedTerm[]; exclude: TemplatedTerm[] };
