import { v, type Infer } from "convex/values";

/**
 * A date is a record because the parts are separately meaningful — a formula can
 * ask for the month, and a date with no time is not the same value as one at
 * midnight. `calendar` is present and single-valued so that a stored date never
 * means whatever the code assumed when it was written.
 *
 * `utc` is derived from the components and kept anyway: sorting and comparing
 * then go through a plain number. The components are the truth, and `utc` is
 * rewritten whenever one changes — never edited on its own.
 */
export const dateValueValidator = v.object({
  calendar: v.literal("gregorian"),
  year: v.number(),
  month: v.number(),
  day: v.number(),
  hour: v.optional(v.number()),
  minute: v.optional(v.number()),
  second: v.optional(v.number()),
  millisecond: v.optional(v.number()),
  timeZone: v.optional(v.string()),
  utc: v.number()
});

export type DateValue = Infer<typeof dateValueValidator>;

/** A returned table's columns are typed independently; the block's single `format.valueFormat` cannot say that. */
export const formulaColumnValidator = v.object({
  name: v.optional(v.string()),
  valueFormat: v.optional(v.string())
});

export type FormulaColumn = Infer<typeof formulaColumnValidator>;

/**
 * `empty` is not a zero, an empty string, or a `false`. A reference to a blank
 * cell is none of those, and collapsing it into one is how a sum counts a gap as
 * a value. There is no `error` kind either: a failure is a property of the
 * computation, so it lives in the block's `state`.
 *
 * **There is no `reference` kind.** A name that resolves to something else is a
 * `VariableValue`, where the target is a typed union rather than an opaque id —
 * a value that is only an id is one nothing can render without resolving first.
 */
const scalarValueValidator = v.union(
  v.object({ kind: v.literal("empty") }),
  v.object({ kind: v.literal("number"), value: v.number() }),
  v.object({ kind: v.literal("text"), value: v.string() }),
  v.object({ kind: v.literal("boolean"), value: v.boolean() }),
  v.object({ kind: v.literal("date"), value: dateValueValidator })
);

/**
 * **A cell is `v.any()` because the recursion is real and a validator is a
 * value, not a type.** A grouped aggregate returns a table whose cells are
 * tables, and there is no recursive validator to write for that.
 *
 * `v.any()` only at the cell, rather than encoding the whole value as JSON,
 * because the stored bytes then stay the honest shape: everything outside a cell
 * is still checked at the door, a resolver reading a body can still branch on
 * `kind`, and the day a recursive validator exists this tightens with nothing to
 * migrate. The cost is that a malformed nested cell is stored, so a renderer of
 * one is defensive. `FormulaValue` below is the type that stays truthful
 * meanwhile.
 *
 * **There is no `list`, `record`, or `range` kind.** A one-column table is a
 * list; a one-row table whose fields are its columns is a record; and a range is
 * a table because **a value is a result, not a query** — liveness belongs to the
 * formula that recomputes, and a range that stayed live would be the only value
 * kind that changed without anything recomputing it.
 */
export const formulaValueValidator = v.union(
  ...scalarValueValidator.members,
  v.object({
    kind: v.literal("table"),
    columns: v.array(formulaColumnValidator),
    rows: v.array(v.array(v.any()))
  })
);

/** The recursion the validator cannot state. Only the `table` member is written twice. */
export type FormulaValue =
  | Infer<typeof scalarValueValidator>
  | { kind: "table"; columns: FormulaColumn[]; rows: FormulaValue[][] };
