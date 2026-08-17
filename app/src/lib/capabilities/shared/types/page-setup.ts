import { v, type Infer } from "convex/values";

/**
 * A name or explicit dimensions.
 *
 * **A named size is stored as its name**, never resolved to numbers: A4 resolved
 * to 595.28 × 841.89 is indistinguishable from a custom size that happens to
 * match, and no paper picker can then show the right entry.
 */
export const paperSizeValidator = v.union(
  v.literal("letter"),
  v.literal("legal"),
  v.literal("tabloid"),
  v.literal("a3"),
  v.literal("a4"),
  v.literal("a5"),
  v.object({ width: v.number(), height: v.number() })
);

export type PaperSize = Infer<typeof paperSizeValidator>;

/**
 * Physical page dimensions, shared by all three general resources: a document's
 * page, a deck's handout, a sheet's print setup.
 *
 * **Every dimension is in points — 1/72 inch — never pixels.** A pixel has no
 * physical size, and these numbers describe something that will exist on paper.
 * The screen renderer converts at whatever zoom it shows, one-directionally.
 *
 * `orientation` is separate from `paper` rather than a swapped width and height,
 * because landscape A4 is still A4: same sheet, same tray.
 *
 * **This is only the physical sheet.** Headers, footers, page numbers and a
 * different first page are `PageFurniture`, which ships with `documents` — a
 * deck's handout and a sheet's print setup need a paper size and margins and
 * have no headers at all.
 */
export const pageSetupValidator = v.object({
  paper: paperSizeValidator,
  orientation: v.union(v.literal("portrait"), v.literal("landscape")),
  /** The content boundary. A header and footer sit outside it, from the page edge. */
  margins: v.object({
    top: v.number(),
    right: v.number(),
    bottom: v.number(),
    left: v.number()
  })
});

export type PageSetup = Infer<typeof pageSetupValidator>;
