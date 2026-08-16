import { v, type Infer, type Validator } from "convex/values";
import { resourceKindValidator } from "$shared/types/resource";

/**
 * A specific resource, with its kind beside its id.
 *
 * The kind is stored rather than looked up because a set has to be resolvable
 * without probing every table to find out what each id is.
 */
export const resourceRefValidator = v.object({
  kind: resourceKindValidator,
  /** A string permanently: seven kinds answer to it, and one of them is pass 8's `connectors`. */
  id: v.string()
});

export type ResourceRef = Infer<typeof resourceRefValidator>;

/** Selecting resources. Every one of these resolves when used, never when saved. */
const selectors = [
  v.object({ op: v.literal("project") }),
  v.object({ op: v.literal("kind"), kind: resourceKindValidator }),
  v.object({ op: v.literal("resources"), refs: v.array(resourceRefValidator) }),
  v.object({ op: v.literal("set"), setId: v.id("resourceSets") })
];

/** Combining them. `union` takes a list so five kinds are one node, not four. */
const combining = <T extends Validator<unknown, "required", string>>(inner: T) => [
  v.object({ op: v.literal("union"), of: v.array(inner) }),
  v.object({ op: v.literal("difference"), from: inner, remove: inner })
];

const depth1 = v.union(...selectors);
const depth2 = v.union(...selectors, ...combining(depth1));
const depth3 = v.union(...selectors, ...combining(depth2));

/**
 * How a group of resources is named — for retrieval scope, for generation
 * inputs, for anything that says *these* rather than everything.
 *
 * **An expression, resolved when used.** `{ op: "project" }` means the resources
 * in this project, and one created tomorrow is in it; an id list captured today
 * would silently mean "the project as it was" and start decaying the moment it
 * was saved.
 *
 * **The nesting is unrolled rather than recursive**, because a Convex validator
 * is data and cannot refer to itself. Four levels is where it stops, and
 * `{ op: "set" }` is what goes deeper: an expression worth nesting further is an
 * expression worth naming.
 *
 * It lives here rather than in `resourceSets` because a persona's scope, a
 * prompt block's, and a derived output's inputs are all this same question, and
 * whichever table was built first would be an odd place for the others to import
 * it from.
 */
export const setExpressionValidator = v.union(...selectors, ...combining(depth3));

export type SetExpression = Infer<typeof setExpressionValidator>;
