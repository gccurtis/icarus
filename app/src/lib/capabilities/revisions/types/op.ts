import { v, type Infer } from "convex/values";

/**
 * What an op acts on, beside the path that locates it.
 *
 * **It exists so the conflict ladder can pre-filter without resolving paths
 * against a body.** A row insert cannot collide with a mark edit, and knowing
 * that cheaply is what makes the cheap checks cheap. Every other use reads the
 * path.
 *
 * Content targets apply anywhere content does; the rest belong to one body
 * shape. `field` is the catch-all for a scalar on the body itself — page setup,
 * theme, a style set.
 *
 * **`mergedCells`, not `merge`.** Every other member is a noun naming a thing,
 * and `merge` read as the verb for the operation being performed on it.
 *
 * **`range` is a member** because a path can address one: a formula's operands
 * and a print area both name a range rather than a cell.
 *
 * An `analytic` is the saved ordered computation. `analyticComponent` is its
 * reusable materialized output, `chart` is the nested visual declaration, and
 * `chartElement` is one identified annotation inside that chart. Keeping all
 * four prevents a data-pipeline edit, placement change, visual-format edit and
 * CAGR/reference-line edit from becoming the same conflict.
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
  v.literal("range"),
  v.literal("mergedCells"),
  v.literal("analytic"),
  v.literal("analyticComponent"),
  v.literal("chart"),
  v.literal("chartElement"),

  v.literal("field")
);

export type OpTarget = Infer<typeof opTargetValidator>;

/** A sibling id, or `null` for the head of a list. */
const afterValidator = v.union(v.string(), v.null());

/**
 * Replace a value. `was` is what it replaced.
 *
 * `was` is not an optimisation and not an audit trail — it is what makes the op
 * invertible without reading a body, which is the whole reason an undo can be
 * assembled on the client.
 *
 * **Absence is `null`, never `undefined`.** Convex does not store `undefined` —
 * an absent field and a field holding `undefined` are one thing to it — so
 * setting something that did not exist yet inverts to `was: null`. Both fields
 * are required for the same reason: an op that omitted `was` would invert into a
 * set to nothing at all.
 */
export const setOpValidator = v.object({
  op: v.literal("set"),
  target: opTargetValidator,
  path: v.string(),
  value: v.any(),
  was: v.any()
});

/**
 * Add `values` after `after`, or at the head when it is `null`.
 *
 * **`ids` is a departure from the stage 0 design, and it is what makes the
 * inversion claim true.** That shape carried `values` alone, and a `remove`
 * naming what to take out needs *ids* — so inverting an insert would have meant
 * reading an id out of each opaque value, which is a body-shape assumption the
 * client is not allowed to make. Carrying them makes `insert` and `remove`
 * exact mirrors: same `ids`, same `after`, same `values`, opposite direction.
 *
 * The cost is that the ids are stated twice on the wire — once here and once
 * inside each value. Cheap, and it is the only version of this op that a client
 * can invert without opening the envelope.
 */
export const insertOpValidator = v.object({
  op: v.literal("insert"),
  target: opTargetValidator,
  path: v.string(),
  ids: v.array(v.string()),
  after: afterValidator,
  values: v.array(v.any())
});

/**
 * Take `ids` out. Carries both what it removed and where they sat, because an
 * insert needs each to put them back.
 */
export const removeOpValidator = v.object({
  op: v.literal("remove"),
  target: opTargetValidator,
  path: v.string(),
  ids: v.array(v.string()),
  after: afterValidator,
  values: v.array(v.any())
});

/** Reposition one id. `wasAfter` is the sibling it used to follow. */
export const moveOpValidator = v.object({
  op: v.literal("move"),
  target: opTargetValidator,
  path: v.string(),
  id: v.string(),
  after: afterValidator,
  wasAfter: afterValidator
});

/**
 * An in-place string edit: at offset `at`, delete `remove` and insert `insert`.
 *
 * **The only pairing this vocabulary enforces.** `target` is pinned to `atom`,
 * because a formula atom is changed by `set`ting its `formulaId` rather than by
 * editing its text — which keeps the one in-place string edit in the system to
 * one kind of string, and that precondition is what makes offset shifting safe
 * to attempt at all.
 *
 * Both strings are present and either may be empty: carrying what it removed is
 * what inverts it, and swapping the two fields is the whole inversion.
 */
export const textOpValidator = v.object({
  op: v.literal("text"),
  target: v.literal("atom"),
  path: v.string(),
  at: v.number(),
  insert: v.string(),
  remove: v.string()
});

/**
 * Five untyped ops over a path. Everything that edits a body is written in them.
 *
 * **Five ops over a path, not a typed vocabulary.** `rowInsert`, `blockSet` and
 * `themeSet` would encode in the op name what the path already encodes, and
 * every new field in any body would need a new op type.
 *
 * **Every op is closed under inversion**, which is what the extra payloads buy:
 * `was` reverses a `set`, `values` and `after` reverse a `remove`, `wasAfter`
 * reverses a `move`, and `text` swaps its two strings. An undo is an ordinary
 * change set rather than a rewind, and — the part that matters to the client —
 * inverting one never requires reading the body it applies to.
 *
 * **Nothing here resolves a path.** A path is `/`-delimited, a `#id` segment
 * resolves by search, a numeric segment indexes, anything else is a key — and
 * that is the server's to walk. The client carries envelopes.
 */
export const opValidator = v.union(
  setOpValidator,
  insertOpValidator,
  removeOpValidator,
  moveOpValidator,
  textOpValidator
);

/**
 * **The one place the validator and the type disagree**, and the same compromise
 * [`content`](../../content/types/value.ts) makes for the same reason.
 *
 * A payload is `v.any()` at the door because an op is generic over three body
 * shapes and there is no union to write for "whatever lives at that path". But
 * `Infer` turns `v.any()` into `any`, and `any` spreads: a runtime that buffers
 * ops would silently lose type safety everywhere one is touched. So the payload
 * fields are restated as `unknown`, which is what a carrier of an opaque value
 * should hold, and the five arms are written twice.
 *
 * Accepted cost: a malformed payload is storable. Everything outside a payload —
 * the op name, the target, the path, the ordering fields — is still checked.
 */
export type Op =
  | { op: "set"; target: OpTarget; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: OpTarget;
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "remove";
      target: OpTarget;
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "move";
      target: OpTarget;
      path: string;
      id: string;
      after: string | null;
      wasAfter: string | null;
    }
  | { op: "text"; target: "atom"; path: string; at: number; insert: string; remove: string };
