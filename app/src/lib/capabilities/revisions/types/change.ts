import { v, type Infer } from "convex/values";

/**
 * The three general resources. One change-set table and one snapshot table serve
 * all of them, because replay is generic over ops and never inspects a body.
 */
export const resourceTypeValidator = v.union(
  v.literal("document"),
  v.literal("slides"),
  v.literal("spreadsheet")
);

export type ResourceType = Infer<typeof resourceTypeValidator>;

/** The whole key. Never the id alone — two resources of different kinds may carry the same one. */
export type ResourceKey = { resourceType: ResourceType; resourceId: string };

/**
 * What kind of thing an op addresses; `path` says which one.
 *
 * Without it `values` is `unknown[]`, and the conflict ladder would have to
 * resolve paths against the body to learn that a row insert cannot collide with
 * a mark edit.
 */
export const opTargetValidator = v.union(
  v.literal("row"),
  v.literal("block"),
  v.literal("atom"),
  v.literal("mark"),
  v.literal("slide"),
  v.literal("element"),
  v.literal("section"),
  v.literal("sheet"),
  v.literal("cell"),
  v.literal("merge"),
  v.literal("chart"),
  v.literal("field")
);

export type OpTarget = Infer<typeof opTargetValidator>;

/**
 * The five ops, closed under inversion — which is what the extra payloads buy:
 * `was` reverses a `set`, `values` and `after` reverse a `remove`, `wasAfter`
 * reverses a `move`. An undo is an ordinary change set, not a rewind.
 *
 * **`text` targets literal atoms only.** A formula's expression is replaced with
 * `set`, which keeps the one in-place string edit in the system to one kind of
 * string — the precondition that makes offset shifting safe to attempt. The
 * remaining legal pairings are stated in `types.md`; a validator cannot hold
 * them without writing the union out per target.
 */
export const opValidator = v.union(
  v.object({
    op: v.literal("set"),
    target: opTargetValidator,
    path: v.string(),
    value: v.any(),
    was: v.any()
  }),
  v.object({
    op: v.literal("insert"),
    target: opTargetValidator,
    path: v.string(),
    after: v.union(v.string(), v.null()),
    values: v.array(v.any())
  }),
  v.object({
    op: v.literal("remove"),
    target: opTargetValidator,
    path: v.string(),
    ids: v.array(v.string()),
    after: v.union(v.string(), v.null()),
    values: v.array(v.any())
  }),
  v.object({
    op: v.literal("move"),
    target: opTargetValidator,
    path: v.string(),
    id: v.string(),
    after: v.union(v.string(), v.null()),
    wasAfter: v.union(v.string(), v.null())
  }),
  v.object({
    op: v.literal("text"),
    target: v.literal("atom"),
    path: v.string(),
    at: v.number(),
    insert: v.string(),
    remove: v.string()
  })
);

export type Op = Infer<typeof opValidator>;
