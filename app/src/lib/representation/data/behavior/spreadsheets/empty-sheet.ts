import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";

export const EMPTY_ROWS = 100;
export const EMPTY_COLUMNS = 100;

export const emptyBody = (): SpreadsheetBody => ({
  rows: Array.from({ length: EMPTY_ROWS }, (_, index) => ({ id: `r${index + 1}`, order: index + 1 })),
  columns: Array.from({ length: EMPTY_COLUMNS }, (_, index) => ({
    id: `c${index + 1}`,
    order: index + 1
  })),
  rowPartCounts: [EMPTY_ROWS],
  formatRules: [],
  print: {
    page: {
      paper: "letter",
      orientation: "landscape",
      margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }
    },
    gridlines: true,
    headings: false
  },
  styles: {
    styles: {
      body: { name: "Body" },
      header: { name: "Header", fontWeight: 600, horizontalAlignment: "center" },
      total: { name: "Total", fontWeight: 600 }
    },
    defaultKey: "body"
  }
});

export const emptySheet = (): LiveSheet => ({ body: emptyBody(), cells: {} });
