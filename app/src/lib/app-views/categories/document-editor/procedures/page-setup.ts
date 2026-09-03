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

const PAGE_WIDTH_REM = 52;
const BODY_FONT_SIZE_REM = 1;
const BODY_LINE_HEIGHT_REM = 1.625;
const AVERAGE_GLYPH_WIDTH_EM = 0.52;

export const layoutMetrics = (setup: PageSetup) => {
  const dimensions = paperDimensions(setup.paper);
  const paper =
    setup.orientation === "portrait"
      ? dimensions
      : { width: dimensions.height, height: dimensions.width };
  const scale = PAGE_WIDTH_REM / paper.width;
  const contentWidth = (paper.width - setup.margins.left - setup.margins.right) * scale;
  const contentHeight = (paper.height - setup.margins.top - setup.margins.bottom) * scale;
  const charactersPerLine = Math.floor(
    contentWidth / (BODY_FONT_SIZE_REM * AVERAGE_GLYPH_WIDTH_EM)
  );
  const linesPerPage = Math.floor(contentHeight / BODY_LINE_HEIGHT_REM);

  return {
    pageWidth: PAGE_WIDTH_REM,
    paper,
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
