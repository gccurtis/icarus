import { describe, expect, it } from "vitest";
import { validate } from "convex-helpers/validators";
import {
  emptySpreadsheetBody,
  sheetValidator,
  spreadsheetBodyValidator
} from "$spreadsheets/types/body";

const print = {
  page: {
    paper: "a4",
    orientation: "landscape",
    margins: { top: 36, right: 36, bottom: 36, left: 36 }
  }
};

const cell = {
  blocks: [
    {
      id: "b1",
      type: "formula",
      expression: "=SUM(B2:B10)",
      display: "42",
      value: { kind: "number", value: 42 },
      state: "fresh"
    }
  ]
};

const sheet = {
  id: "sh1",
  name: "Sheet1",
  cells: { B7: cell },
  merges: ["B2:D4"],
  spills: [],
  charts: [],
  rowCount: 1000,
  columnCount: 26,
  print
};

describe("spreadsheetBodyValidator", () => {
  it("holds the sheets, the names, and the styles, and nothing of the row", () => {
    expect(Object.keys(spreadsheetBodyValidator.fields).sort()).toEqual([
      "namedRanges",
      "sheets",
      "styles"
    ]);
    expect(validate(spreadsheetBodyValidator, { ...emptySpreadsheetBody(), sheets: [sheet] })).toBe(
      true
    );
  });

  it("names a range by sheet and address, so a formula can use the name", () => {
    const namedRanges = [{ name: "Revenue", sheet: "sh1", range: "B2:B10" }];
    expect(
      validate(spreadsheetBodyValidator, { ...emptySpreadsheetBody(), sheets: [sheet], namedRanges })
    ).toBe(true);
  });
});

describe("a sheet's cells", () => {
  it("are keyed by A1 notation and carry no id of their own", () => {
    expect(sheetValidator.fields.cells.kind).toBe("record");
    expect(validate(sheetValidator, { ...sheet, cells: { B7: { ...cell, id: "c1" } } })).toBe(false);
  });

  it("hold blocks, so a cell is a value or prose without a second editor", () => {
    const prose = {
      blocks: [
        {
          id: "b2",
          type: "text",
          variant: "paragraph",
          atoms: [{ id: "a1", kind: "literal", text: "Revenue" }],
          display: "Revenue",
          marks: []
        }
      ]
    };
    expect(validate(sheetValidator, { ...sheet, cells: { A1: prose, B7: cell } })).toBe(true);
  });

  it("are sparse, so an empty sheet stores no cells and still draws a grid", () => {
    expect(validate(sheetValidator, { ...sheet, cells: {} })).toBe(true);
    // The declared extent is independent of which cells hold content.
    expect(sheetValidator.fields.rowCount.kind).toBe("float64");
    expect(sheetValidator.fields.columnCount.kind).toBe("float64");
  });
});

describe("a sheet", () => {
  it("stores merges as ranges, because nothing else records them", () => {
    expect(validate(sheetValidator, { ...sheet, merges: [] })).toBe(true);
    expect(validate(sheetValidator, { ...sheet, merges: [{ from: "B2", to: "D4" }] })).toBe(false);
  });

  it("records a spill as what a formula occupies, never as something to edit", () => {
    const spills = [{ origin: "B2", range: "B2:D10" }];
    expect(validate(sheetValidator, { ...sheet, spills })).toBe(true);
  });

  it("anchors a chart with an offset rather than giving it a range", () => {
    const chart = {
      id: "ch1",
      anchor: { cell: "F2", dx: 4, dy: 4 },
      size: { width: 360, height: 240 },
      kind: "column",
      data: "Sheet1!A1:D20"
    };
    expect(validate(sheetValidator, { ...sheet, charts: [chart] })).toBe(true);
    // A chart occupying a region would couple its size to row and column heights.
    expect(validate(sheetValidator, { ...sheet, charts: [{ ...chart, range: "F2:J20" }] })).toBe(
      false
    );
    // Everything but a cell carries an id, which is what a change set addresses.
    const { id: _id, ...anonymous } = chart;
    expect(validate(sheetValidator, { ...sheet, charts: [anonymous] })).toBe(false);
  });

  it("sets print up per sheet, because sheets in one workbook are different shapes", () => {
    expect(sheetValidator.fields.print.kind).toBe("object");
    const { print: _print, ...unprintable } = sheet;
    expect(validate(sheetValidator, unprintable)).toBe(false);
    expect(validate(sheetValidator, { ...sheet, print: { ...print, scale: "fit-width" } })).toBe(true);
    expect(validate(sheetValidator, { ...sheet, print: { ...print, scale: "fit-everything" } })).toBe(
      false
    );
  });

  it("measures column widths and row heights in points, keyed by their ruler labels", () => {
    expect(
      validate(sheetValidator, { ...sheet, columnWidths: { B: 96 }, rowHeights: { "7": 18 } })
    ).toBe(true);
  });
});

describe("emptySpreadsheetBody", () => {
  it("is a workbook with no sheets, and is a body the schema admits", () => {
    const body = emptySpreadsheetBody();

    expect(body.sheets).toEqual([]);
    expect(validate(spreadsheetBodyValidator, body)).toBe(true);
  });
});
