import type { CellRange, CellRef } from "$representation/data/types/content/formula-value";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";

/**
 * What an id in a stored formula points at.
 *
 * A formula is project global, so an address carries the resource as well as the
 * place inside it. There is no `"B7"` here and never will be: the sheet that
 * owns the cells turns what a person typed into these before the formula is
 * stored, and turns them back for display.
 */
export type Address =
  | { at: "resource"; ref: ResourceRef }
  | { at: "cell"; resourceId: Id<"spreadsheets">; cell: CellRef }
  | { at: "range"; resourceId: Id<"spreadsheets">; range: CellRange };

/** Where a positional slice cuts. `pick` takes one; `span` takes a run. */
export type Slice =
  | { kind: "pick"; at: number }
  | { kind: "span"; from?: number; to?: number };

export type UnaryOperator = "-" | "+" | "not";

export type BinaryOperator =
  | "or"
  | "and"
  | "="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">="
  | "&"
  | "+"
  | "-"
  | "*"
  | "/"
  | "^";

/**
 * One formula, read. Nothing here knows what a spreadsheet is: a name is a word
 * to be resolved, and an address is an id somebody else can answer for.
 */
export type Expression =
  | { kind: "literal"; value: FormulaValue }
  | { kind: "name"; name: string }
  | { kind: "address"; address: Address }
  | { kind: "call"; name: string; arguments: readonly Expression[] }
  | { kind: "unary"; operator: UnaryOperator; of: Expression }
  | { kind: "binary"; operator: BinaryOperator; left: Expression; right: Expression }
  | { kind: "field"; of: Expression; field: string }
  | { kind: "index"; of: Expression; slice: Slice }
  | { kind: "query"; of: Expression; keep: readonly string[]; where: readonly Expression[] }
  | { kind: "resolve"; of: Expression }
  | { kind: "percent"; of: Expression };
