import { v, type Infer } from "convex/values";
import { CommentsError } from "$comments/errors";

/**
 * The smallest thing a person actually pointed at. Absent means the whole object.
 *
 * **There is no `row` variant.** Nobody points at a row; they select text, or they
 * comment on the document. Rows are layout.
 *
 * A `cell` is named by its address rather than an id, because that is what a cell's
 * identity is — the same reason a sheet's cells are keyed by A1 notation.
 */
export const anchorWithinValidator = v.union(
  v.object({ kind: v.literal("slide"), slideId: v.string() }),
  v.object({ kind: v.literal("element"), elementId: v.string() }),
  v.object({ kind: v.literal("cell"), sheetId: v.string(), ref: v.string() }),
  v.object({
    kind: v.literal("text"),
    blockId: v.string(),
    /** UTF-16 offsets into the block's `display`, exactly as a mark's are. */
    from: v.number(),
    to: v.number()
  })
);

export type AnchorWithin = Infer<typeof anchorWithinValidator>;

/**
 * What a discussion can hang on.
 *
 * `question`, `hypothesis`, and `finding` arrive in pass 4 and are named here
 * anyway: an anchor is a kind string and an id, so it does not need their tables
 * to exist.
 */
export const commentTargetValidator = v.union(
  v.literal("document"),
  v.literal("slides"),
  v.literal("spreadsheet"),
  v.literal("externalFile"),
  v.literal("question"),
  v.literal("hypothesis"),
  v.literal("finding")
);

export type CommentTarget = Infer<typeof commentTargetValidator>;

/**
 * Where a thread points.
 *
 * `targetId` is `v.string()` rather than a `v.id`: seven tables, and a union of
 * id types would make every reader choose between them to render one list.
 */
export const commentAnchorValidator = v.object({
  targetType: commentTargetValidator,
  targetId: v.string(),
  within: v.optional(anchorWithinValidator),
  /** What was selected. Absent when nothing was. */
  quote: v.optional(v.string())
});

export type CommentAnchor = Infer<typeof commentAnchorValidator>;

/**
 * Which `within` each target can hold. A validator cannot state this — it is a
 * constraint between two fields — so it is stated once here and enforced by
 * everything that stores an anchor.
 *
 * A slide is in the slides row because a slide is a thing you comment on *as a
 * slide*: "this one needs rework" is about the slide, not about anything on it,
 * and it is a different remark from one about the deck.
 */
const legalWithin: Record<CommentTarget, ReadonlySet<AnchorWithin["kind"]>> = {
  document: new Set(["text"]),
  slides: new Set(["slide", "element", "text"]),
  spreadsheet: new Set(["cell", "text"]),
  externalFile: new Set(),
  question: new Set(["text"]),
  hypothesis: new Set(["text"]),
  finding: new Set(["text"])
};

/**
 * The stored form of an anchor: the pairing checked, and the range sane.
 *
 * An anchor a target cannot hold is not a near miss to be tolerated — a cell
 * anchor on a document names a sheet nothing in a document has, so nothing would
 * ever render the thread and the remark is lost silently.
 */
export const commentAnchor = (anchor: CommentAnchor): CommentAnchor => {
  const { targetType, within } = anchor;

  if (within && !legalWithin[targetType].has(within.kind)) {
    throw new CommentsError(
      "anchor-mismatch",
      `A ${targetType} holds no ${within.kind} to comment on`
    );
  }
  if (within?.kind === "text" && within.to < within.from) {
    throw new CommentsError("anchor-range", `A text anchor ends at ${within.to}, before ${within.from}`);
  }
  return anchor;
};
