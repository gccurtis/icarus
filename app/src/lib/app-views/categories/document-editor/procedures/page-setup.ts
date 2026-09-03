import type { PageSetup } from "$representation/data/types/documents/page-setup";

/** The layout a new document uses until document bodies persist their own setup. */
export const DEFAULT_PAGE_SETUP: PageSetup = {
  paper: "letter",
  orientation: "portrait",
  margins: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 }
};

const PAPER_LABEL: Record<Exclude<PageSetup["paper"], object>, string> = {
  letter: "Letter",
  legal: "Legal",
  tabloid: "Tabloid",
  a3: "A3",
  a4: "A4",
  a5: "A5"
};

const PAPER_DIMENSIONS: Record<Exclude<PageSetup["paper"], object>, { width: number; height: number }> = {
  letter: { width: 8.5, height: 11 },
  legal: { width: 8.5, height: 14 },
  tabloid: { width: 11, height: 17 },
  a3: { width: 11.69, height: 16.54 },
  a4: { width: 8.27, height: 11.69 },
  a5: { width: 5.83, height: 8.27 }
};

export const paperLabel = (paper: PageSetup["paper"]): string =>
  typeof paper === "object" ? `${paper.width} x ${paper.height} in` : PAPER_LABEL[paper];

export const paperDimensions = (
  paper: PageSetup["paper"]
): { readonly width: number; readonly height: number } =>
  typeof paper === "object" ? paper : PAPER_DIMENSIONS[paper];

export const orientationLabel = (orientation: PageSetup["orientation"]): string =>
  orientation === "portrait" ? "Portrait" : "Landscape";

export const inches = (value: number): string => `${value.toFixed(2)} in`;

export type Size = { readonly width: number; readonly height: number };

export const figures = (held: Size): string =>
  `${held.width.toFixed(2)} × ${held.height.toFixed(2)}`;

export const size = (held: Size, unit: string): string => `${figures(held)} ${unit}`;

const PAGE_WIDTH_REM = 52;
const BODY_FONT_SIZE_REM = 1;
const BODY_LINE_HEIGHT_REM = 1.625;
const AVERAGE_GLYPH_WIDTH_EM = 0.52;

/**
 * What the page can be drawn at, as a percentage of its true size. 100 is the
 * page at the dimensions it would print at; nothing below 50 leaves a readable
 * measure, and nothing above 200 fits a page on a screen.
 */
export const MINIMUM_ZOOM = 50;
export const MAXIMUM_ZOOM = 200;

/** What one press of the picker moves, and the precision a zoom is held to. */
export const ZOOM_STEP = 5;

export const clampZoom = (zoom: number): number =>
  Math.min(Math.max(Math.round(zoom), MINIMUM_ZOOM), MAXIMUM_ZOOM);

/**
 * What is left either side of the page, in rem. The gutter is scenery, so it
 * gives way before the page does: it collapses from the maximum to the minimum
 * as the surface narrows, and only once the page will not fit inside the
 * minimum does the surface scroll sideways.
 */
export const MAXIMUM_GUTTER = 2.5;
export const MINIMUM_GUTTER = 0.75;

/** The largest a page can be drawn on a surface this wide without it scrolling sideways. */
export const fitZoom = (available: number, pageWidth: number): number =>
  clampZoom(Math.floor(((available - MINIMUM_GUTTER * 2) / pageWidth) * 100));

export const gutterOf = (available: number, drawnWidth: number): number =>
  Math.min(MAXIMUM_GUTTER, Math.max(MINIMUM_GUTTER, (available - drawnWidth) / 2));

export const layoutMetrics = (setup: PageSetup, zoom = 100) => {
  const dimensions = paperDimensions(setup.paper);
  const paper =
    setup.orientation === "portrait"
      ? dimensions
      : { width: dimensions.height, height: dimensions.width };
  const scale = PAGE_WIDTH_REM / paper.width;
  const content = {
    width: paper.width - setup.margins.left - setup.margins.right,
    height: paper.height - setup.margins.top - setup.margins.bottom
  };
  const page = { width: PAGE_WIDTH_REM, height: paper.height * scale };
  const at = clampZoom(zoom) / 100;

  const charactersPerLine = Math.floor(
    (content.width * scale) / (BODY_FONT_SIZE_REM * AVERAGE_GLYPH_WIDTH_EM)
  );
  const linesPerPage = Math.floor((content.height * scale) / BODY_LINE_HEIGHT_REM);

  return {
    pageWidth: page.width,
    pageHeight: page.height,
    zoom: clampZoom(zoom),
    paper,
    content,
    drawn: { width: page.width * at, height: page.height * at },
    marginPercent: {
      top: (setup.margins.top / paper.width) * 100,
      right: (setup.margins.right / paper.width) * 100,
      bottom: (setup.margins.bottom / paper.width) * 100,
      left: (setup.margins.left / paper.width) * 100
    },
    charactersPerLine,
    linesPerPage,
    pageTextCapacity: charactersPerLine * linesPerPage,
    bodyFontSize: "16px",
    bodyLineHeight: "26px"
  };
};
