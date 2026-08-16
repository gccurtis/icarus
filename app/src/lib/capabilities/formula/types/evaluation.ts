import type { FormulaValue } from "$content/types/value";

/**
 * The values a formula can see around it, keyed by A1 address.
 *
 * Supplied by the caller because a formula does not know what holds it — a sheet
 * cell, a paragraph, a slide. Making this capability read a sheet would tie
 * evaluation to one resource type and to the revision machinery underneath it.
 * A cell not present here is blank, which is not the same as absent.
 */
export type Cells = Readonly<Record<string, FormulaValue>>;

/**
 * What an evaluation produced, in the shape a formula block stores.
 *
 * **An error is a state, not a value.** `FormulaValue` has no error kind, so a
 * consumer holding a value never has to re-check whether it really is one — and
 * a caller writing this onto a block copies `state` and either `value` or
 * `error` straight across.
 */
export type Evaluation =
  | { readonly state: "fresh"; readonly value: FormulaValue }
  | { readonly state: "error"; readonly error: string };
