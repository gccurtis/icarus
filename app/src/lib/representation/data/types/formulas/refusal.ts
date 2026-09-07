import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Id } from "$representation/data/types/core/id";

/**
 * Every way a formula can decline to answer. The list is declared rather than
 * inferred, so a new one is an edit somebody makes on purpose.
 */
export type ErrorToken =
  | "#DIV/0!"
  | "#VALUE!"
  | "#NAME?"
  | "#REF!"
  | "#NUM!"
  | "#N/A"
  | "#NULL!"
  | "#ERROR!"
  | "#CYCLE!"
  | "#FIELD?"
  | "#INDEX!"
  | "#SHAPE!";

/** The cell a refusal started in, so a total three hops away can point at it. */
export type Origin = {
  resourceId: Id<"spreadsheets">;
  rowId: string;
  columnId: string;
};

/**
 * A refusal is not a value. It carries the token, the word it could not place
 * where there is one, and where it started when the answer travelled.
 */
export type Refusal = {
  token: ErrorToken;
  word?: string;
  at?: Origin;
};

/** What asking a formula produces: a value, or a reason there is not one. */
export type Answer = { ok: true; value: FormulaValue } | { ok: false; refusal: Refusal };
