import type { Id } from "$convex/_generated/dataModel";
import { ResourceSetsError } from "$resource-sets/errors";
import type { Actor } from "$shared/types/actor";
import type { SetExpression } from "$shared/types/set-expression";

/**
 * A named group of resources, as a picker or an editor sees it.
 *
 * **It carries the expression, never what the expression selects.** What a set
 * currently contains is [`resolve`](../api/resolve/resolve.md)'s answer at the
 * moment it was asked, and putting a copy of it here would turn a list read into
 * a walk of every table — while inviting a reader to treat a stale copy as the
 * set.
 */
export type ResourceSet = {
  readonly id: Id<"resourceSets">;
  readonly name: string;
  readonly description?: string;
  readonly expression: SetExpression;
  readonly createdBy: Actor;
  readonly revision: number;
  readonly updatedAt: number;
};

/** What an author supplies. No project and no attribution: both come from the scope. */
export type ResourceSetDraft = {
  readonly name: string;
  readonly description?: string;
  readonly expression: SetExpression;
};

/**
 * The stored form of a name: trimmed, and never empty.
 *
 * A set is chosen by name in every surface that offers one, and referenced by
 * name in the refusal a cycle produces. An unnamed set is a row nobody can pick
 * again and a cycle nobody can read.
 */
export const resourceSetName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ResourceSetsError("empty-name", "A resource set must have a name");
  }
  return trimmed;
};
