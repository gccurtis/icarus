/** The three resources edited through ops. Closed: adding one is real work, not configuration. */
export type GeneralResourceType = "document" | "slides" | "spreadsheet";

type SetTarget =
  | "row"
  | "block"
  | "atom"
  | "mark"
  | "slide"
  | "element"
  | "section"
  | "cell"
  | "formatRule"
  | "chart"
  | "chartElement"
  | "field";

type InsertTarget =
  | "row"
  | "block"
  | "atom"
  | "mark"
  | "slide"
  | "element"
  | "section"
  | "gridRow"
  | "gridColumn"
  | "formatRule"
  | "chart"
  | "chartElement";

type RemoveTarget =
  | "row"
  | "block"
  | "atom"
  | "mark"
  | "slide"
  | "element"
  | "section"
  | "cell"
  | "gridRow"
  | "gridColumn"
  | "formatRule"
  | "chart"
  | "chartElement";

type MoveTarget =
  | "row"
  | "block"
  | "slide"
  | "element"
  | "section"
  | "gridRow"
  | "gridColumn"
  | "chart"
  | "chartElement";

/** A sibling id, or `null` for the head of a list. */
type After = string | null;

/**
 * Five ops over a path.
 *
 * Every op is closed under inversion, which is what the extra payloads buy:
 * `was` reverses a set, `values` and `after` reverse a remove, `wasAfter`
 * reverses a move. An undo is an ordinary change set, not a rewind.
 *
 * Each op names its own targets, so a nonsensical op is refused rather than
 * failing when something tries to apply it. `gridRow` and `gridColumn` are not
 * `row`: a document row and a spreadsheet row are different things.
 *
 * `cell` takes no insert and no move — a cell has no ordinal position, and where
 * it sits is which row and column it names.
 *
 * `value` and `values` are `unknown` because a payload is whatever sits at the
 * path. Naming them would be this type knowing what a slide is.
 */
export type Op =
  | { op: "set"; target: SetTarget; path: string; value: unknown; was: unknown }
  | { op: "insert"; target: InsertTarget; path: string; after: After; values: unknown[] }
  | {
      op: "remove";
      target: RemoveTarget;
      path: string;
      ids: string[];
      after: After;
      values: unknown[];
    }
  | { op: "move"; target: MoveTarget; path: string; id: string; after: After; wasAfter: After }
  /** Literal atoms only. A formula atom changes by `set`ting its expression. */
  | { op: "text"; target: "atom"; path: string; at: number; insert: string; remove: string };
