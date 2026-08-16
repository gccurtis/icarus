import { v, type Infer } from "convex/values";
import { blockValidator } from "$content/types/block";
import { pageSetupValidator } from "$shared/types/page-setup";
import { styleSetValidator } from "$shared/types/style-set";

/**
 * The horizontal unit of a document. A union rather than one shape because the
 * things that occupy a full width are genuinely different kinds of thing —
 * content, a rule, a break.
 *
 * **There is no empty kind.** An empty line is a `blocks` row holding one text
 * block with no atoms, which is what pressing Enter twice already produces — and
 * it keeps its style, so the gap under a heading is the heading's.
 *
 * `proportions` is relative and shares the width equally when absent. Absolute
 * widths would break the moment the paper or the margins changed, and filling
 * the measure is the whole point of a row.
 */
export const documentRowValidator = v.union(
  v.object({
    id: v.string(),
    kind: v.literal("blocks"),
    blocks: v.array(blockValidator),
    proportions: v.optional(v.array(v.number()))
  }),
  v.object({
    id: v.string(),
    kind: v.literal("divider"),
    color: v.optional(v.string()),
    width: v.optional(v.number()),
    style: v.optional(v.union(v.literal("solid"), v.literal("dashed"), v.literal("dotted")))
  }),
  /** A break someone asked for. Where a page naturally ends is computed at render time. */
  v.object({ id: v.string(), kind: v.literal("pageBreak") })
);

export type DocumentRow = Infer<typeof documentRowValidator>;

/**
 * A running head or foot. Rows, so a header splits into a title and a date the
 * same way body content does.
 *
 * `distanceFromEdge` is from the paper edge rather than the text area, because
 * furniture lives outside the margins and that is how it is specified.
 *
 * `pageNumber` is a property of the furniture rather than a block in it: the
 * number is generated per page, and a block rendering differently on every page
 * would break the one-block-one-value rule the content model rests on.
 */
const pageFurnitureValidator = v.object({
  rows: v.array(documentRowValidator),
  /** Different first page — a title page with no running head. Rows, not a suppress flag. */
  firstPageRows: v.optional(v.array(documentRowValidator)),
  distanceFromEdge: v.number(),
  pageNumber: v.optional(
    v.object({
      position: v.union(v.literal("start"), v.literal("center"), v.literal("end")),
      format: v.optional(v.string()),
      startAt: v.optional(v.number()),
      hideOnFirstPage: v.optional(v.boolean())
    })
  )
});

/**
 * What a document says, as one value: the page it is set on, the styles its
 * blocks name, and its content.
 *
 * **Page setup and styles are in here rather than on the row**, and that is the
 * decision the whole body is shaped by: changing a margin or restyling every
 * heading is an edit, edits are change sets, and an undo has to reach them.
 *
 * The metadata is deliberately absent — a renamed document is not a different
 * document, and versioning the title would make a rename a revision.
 */
export const documentBodyValidator = v.object({
  page: pageSetupValidator,
  styles: styleSetValidator,
  rows: v.array(documentRowValidator),
  header: v.optional(pageFurnitureValidator),
  footer: v.optional(pageFurnitureValidator)
});

export type DocumentBody = Infer<typeof documentBodyValidator>;

/**
 * The emptiest document: a page with nothing on it.
 *
 * A4 portrait with one-inch margins is a choice, and it is made here because
 * something has to be stored — the alternative is an optional page setup, which
 * moves the same guess into every renderer. Changing it later is an ordinary
 * edit, which is exactly why it can be a default rather than a question.
 *
 * **No content id is minted.** The first row is the client's to author, so
 * nothing here invents an identity that the id space would then have to honour.
 */
export const emptyDocumentBody = (): DocumentBody => ({
  page: {
    paper: "a4",
    orientation: "portrait",
    margins: { top: 72, right: 72, bottom: 72, left: 72 }
  },
  styles: { styles: { body: { name: "Body" } }, defaultKey: "body" },
  rows: []
});
