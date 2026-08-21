import { v, type Infer } from "convex/values";
import { resourceKindValidator, resourceRefValidator } from "$shared/types/resource";

/**
 * Terms that carry no id, and therefore mean something in any project.
 *
 * This is the whole of what makes a selection portable, which is why it is a
 * type rather than a rule somebody has to remember: a template variable's
 * default is one of these, so a template landing in a new project resolves
 * against that project instead of the one it was authored in.
 */
const projectTerm = v.object({ select: v.literal("project") });

const kindsTerm = v.object({
  select: v.literal("kinds"),
  kinds: v.array(resourceKindValidator)
});

export const portableTermValidator = v.union(projectTerm, kindsTerm);

/**
 * Terms bound to one project — ids, and ids reached through another set.
 *
 * `setId` is an ordinary self-reference: `v.id("resourceSets")` is a tagged
 * string, so it needs the table's *name* and not its validator. Following one
 * reads another row, whose selection may name a third, without limit.
 */
const resourcesTerm = v.object({
  select: v.literal("resources"),
  refs: v.array(resourceRefValidator)
});

const setTerm = v.object({
  select: v.literal("set"),
  setId: v.id("resourceSets")
});

/**
 * One way of naming resources.
 *
 * **`select` rather than `op`.** A term is not an operation — it says what it
 * picks out, and borrowing the word would read as one of the five change ops
 * every time it appeared.
 *
 * `kinds` takes a list, so "documents and decks" is one term rather than two
 * wrapped in a third. Each entry is prefix-matched, so one entry can name a
 * whole family — `externalFile` reaches every subkind beneath it.
 */
export const setTermValidator = v.union(projectTerm, kindsTerm, resourcesTerm, setTerm);

export type SetTerm = Infer<typeof setTermValidator>;

/**
 * Everything in `include`, minus everything in `exclude`.
 *
 * **Two flat lists rather than a tree.** A tree of unions and differences would
 * need a validator that names itself while it is being constructed, which a
 * Convex validator cannot do — it is a runtime value, not a type — so it would
 * have to be unrolled to a fixed depth. Two lists have no self-reference at all,
 * so nothing anywhere is depth-limited.
 *
 * What a single row cannot say directly, a named set says instead:
 *
 * | wanted | written as |
 * | --- | --- |
 * | `A − (B − C)` | name `B − C`, exclude it |
 * | `(A − B) ∪ (C − D)` | name each half, include both |
 * | `A ∩ B` | name `project − B`, exclude it |
 *
 * Each one is a selection convoluted enough to deserve a name a person can read,
 * so the escape hatch is also the better authoring.
 *
 * **An empty `include` selects nothing.** It is the only reading under which
 * excluding from it behaves. A Convex validator has no minimum array length, so
 * that is a check where a selection is accepted rather than a shape here.
 */
export const resourceSelectionValidator = v.object({
  include: v.array(setTermValidator),
  exclude: v.array(setTermValidator)
});

export type ResourceSelection = Infer<typeof resourceSelectionValidator>;

/** A selection a template can carry between projects. */
export const portableSelectionValidator = v.object({
  include: v.array(portableTermValidator),
  exclude: v.array(portableTermValidator)
});

export type PortableSelection = Infer<typeof portableSelectionValidator>;
