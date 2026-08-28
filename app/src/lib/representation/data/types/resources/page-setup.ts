/** A named size stays its name: A4 resolved to numbers is indistinguishable from a custom size that matches. */
export type PaperSize =
  | "letter"
  | "legal"
  | "tabloid"
  | "a3"
  | "a4"
  | "a5"
  | { width: number; height: number };

export type Orientation = "portrait" | "landscape";

/** The content boundary. A header and footer sit outside it. */
export type Margins = { top: number; right: number; bottom: number; left: number };

/**
 * Physical page dimensions. Every number is in points — 1/72 inch — never
 * pixels, because these describe something that will exist on paper.
 *
 * `orientation` is separate from `paper` rather than a swapped width and height,
 * because landscape A4 is still A4.
 */
export type PageSetup = { paper: PaperSize; orientation: Orientation; margins: Margins };
