import { v, type Infer } from "convex/values";
import { blockValidator } from "$content/types/block";
import { pageSetupValidator } from "$shared/types/page-setup";
import { styleSetValidator } from "$shared/types/style-set";

/**
 * A cell is its blocks and nothing else. Alignment, fill, and borders are the
 * block's `format`, and number presentation is `format.valueFormat` — which had
 * to move off the cell once a formula could return a table whose columns are
 * typed independently.
 */
const sheetCellValidator = v.object({ blocks: v.array(blockValidator) });

/**
 * What a formula returning a table occupies, and which formula owns it.
 *
 * Derived from formula results and materialized anyway, on the same terms as
 * `utc` on a date: the formula is the single authority, the range is rewritten on
 * recalculation, and it is never edited. Storing it makes collision detection a
 * lookup rather than an evaluation of every formula on the sheet.
 */
const spillRangeValidator = v.object({ origin: v.string(), range: v.string() });

/**
 * A chart floats above the grid: it anchors to a cell with an offset in points
 * and carries its own size.
 *
 * Not a region, which was the tidier model: a region couples chart size to row
 * and column dimensions, forbids the overlap that is the normal layout, and
 * makes nudging a chart a few points impossible. `data` is a range string rather
 * than extracted values, so the chart follows the sheet.
 */
const sheetChartValidator = v.object({
  id: v.string(),
  anchor: v.object({ cell: v.string(), dx: v.number(), dy: v.number() }),
  size: v.object({ width: v.number(), height: v.number() }),
  kind: v.union(
    v.literal("line"),
    v.literal("bar"),
    v.literal("column"),
    v.literal("area"),
    v.literal("pie"),
    v.literal("scatter")
  ),
  data: v.string(),
  seriesInColumns: v.optional(v.boolean()),
  title: v.optional(v.string()),
  hasHeaders: v.optional(v.boolean())
});

/**
 * Per sheet, not per workbook: sheets in one workbook are routinely different
 * shapes, and one setup would make the workbook printable only for whichever
 * sheet it was configured for.
 *
 * `area` absent prints the used range, which is what a person sees — requiring an
 * explicit area would make every new sheet print nothing.
 */
const sheetPrintValidator = v.object({
  page: pageSetupValidator,
  area: v.optional(v.string()),
  /** "1:2" on every page — what makes a long table readable on paper. */
  repeatRows: v.optional(v.string()),
  repeatColumns: v.optional(v.string()),
  scale: v.optional(v.union(v.number(), v.literal("fit-width"), v.literal("fit-page"))),
  gridlines: v.optional(v.boolean()),
  /** Print the A/B/C and 1/2/3 rulers. */
  headings: v.optional(v.boolean())
});

/**
 * A sparse grid, plus the things that sit across cells rather than in them.
 *
 * **Cells are keyed by A1 notation and carry no id.** A cell's identity *is* its
 * position: `B7` is what a formula references, what a range spans, and what a
 * person means when they point at it. An id would make `=SUM(B2:B10)` resolve
 * through a position-to-id map somebody has to maintain, and a cell moved to
 * another address would keep an identity nothing else in the sheet agrees with.
 * Everything else here — the sheet, its charts, the blocks inside its cells —
 * carries one.
 *
 * The cost is that inserting a row rekeys the cells below it, bounded by
 * *populated* cells rather than the declared extent. `rowCount` and
 * `columnCount` are that declared extent, which is what the grid draws.
 *
 * Widths and heights are points, keyed by the ruler labels a person reads.
 */
export const sheetValidator = v.object({
  id: v.string(),
  name: v.string(),
  cells: v.record(v.string(), sheetCellValidator),
  /** ["B2:D4"] — stored rather than inferred, because nothing else records a merge. */
  merges: v.array(v.string()),
  spills: v.array(spillRangeValidator),
  charts: v.array(sheetChartValidator),
  rowCount: v.number(),
  columnCount: v.number(),
  columnWidths: v.optional(v.record(v.string(), v.number())),
  rowHeights: v.optional(v.record(v.string(), v.number())),
  frozenRows: v.optional(v.number()),
  frozenColumns: v.optional(v.number()),
  print: sheetPrintValidator,
  hidden: v.optional(v.boolean())
});

export type Sheet = Infer<typeof sheetValidator>;

const namedRangeValidator = v.object({ name: v.string(), sheet: v.string(), range: v.string() });

/**
 * What a workbook says, as one value.
 *
 * **The style set is in here rather than on the row**, so restyling headers and
 * totals is an ordinary change set and an undo reaches it — the same reason a
 * document's page setup is in its body.
 */
export const spreadsheetBodyValidator = v.object({
  sheets: v.array(sheetValidator),
  namedRanges: v.optional(v.array(namedRangeValidator)),
  styles: styleSetValidator
});

export type SpreadsheetBody = Infer<typeof spreadsheetBodyValidator>;

/**
 * The emptiest workbook: named styles and no sheets.
 *
 * **No sheet is minted.** A sheet carries an id, and an id invented here is an
 * identity the resource's id space would have to honour — decided by the one
 * party that is not editing. The first sheet is the client's to author, as the
 * first row of a document is.
 */
export const emptySpreadsheetBody = (): SpreadsheetBody => ({
  sheets: [],
  styles: { styles: { body: { name: "Body" } }, defaultKey: "body" }
});
