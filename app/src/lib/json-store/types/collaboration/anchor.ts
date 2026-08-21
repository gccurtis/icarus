import type { Id } from "$json-store/types/core/id";

/**
 * The smallest thing a comment actually points at.
 *
 * Every variant names ids, never positions, so an anchor cannot drift onto the
 * wrong paragraph when something is inserted above it. The one part still
 * positional is `text`'s offsets, which is the arithmetic marks already require.
 *
 * A cell is `(rowId, columnId)` rather than `"B7"`, which names a different cell
 * after an insert. There is no sheet id — a spreadsheet is one grid.
 *
 * A cell has no text range: it holds a value rather than blocks. There is no
 * `row` variant either — nobody points at a document row, they select text.
 */
export type AnchorWithin =
  | { kind: "slide"; slideId: string }
  | { kind: "element"; elementId: string }
  | { kind: "cell"; rowId: string; columnId: string }
  | { kind: "text"; blockId: string; from: number; to: number };

/**
 * Who closed a thread and when. One optional object, so there is no `open` with
 * a resolver. A user rather than an actor: anything can raise a remark, and
 * closing one is a judgement a person makes.
 */
export type Resolution = { by: Id<"users">; at: number };
