import { describe, expect, it } from "vitest";

import {
  columnIndexOf,
  columnLabel,
  gridOf,
  labelOf,
  parseRange,
  parseRef,
  rangeOf,
  rectLabelOf,
  rectOf,
  refsIn,
  type SpreadsheetBody
} from "$app-views/categories/spreadsheet-editor/procedures/addresses";

const body = (): SpreadsheetBody => ({
  rows: [
    { id: "r2", order: 2 },
    { id: "r1", order: 1 },
    { id: "r3", order: 3 }
  ],
  columns: [
    { id: "c1", order: 1 },
    { id: "c3", order: 3 },
    { id: "c2", order: 2 }
  ],
  rowPartCounts: [3],
  formatRules: [],
  print: { page: { paper: "letter", orientation: "portrait", margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } } },
  styles: { styles: { body: { name: "Body" } }, defaultKey: "body" }
});

describe("column labels", () => {
  it("count in letters the way a sheet does", () => {
    expect([0, 1, 25, 26, 27, 701, 702].map(columnLabel)).toEqual(["A", "B", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("read back to the index they came from", () => {
    for (const index of [0, 5, 25, 26, 51, 52, 701, 702, 16383]) {
      expect(columnIndexOf(columnLabel(index))).toBe(index);
    }
    expect(columnIndexOf("a1")).toBeUndefined();
  });
});

describe("the grid", () => {
  it("orders rows and columns by their order, not their position in the body", () => {
    const grid = gridOf(body());

    expect(grid.rows.map((row) => row.id)).toEqual(["r1", "r2", "r3"]);
    expect(grid.columns.map((column) => column.id)).toEqual(["c1", "c2", "c3"]);
    expect(grid.rowAt.get("r3")).toBe(2);
  });

  it("labels a reference by where its ids currently sit", () => {
    const grid = gridOf(body());

    expect(labelOf(grid, { rowId: "r2", columnId: "c3" })).toBe("C2");
    expect(labelOf(grid, { rowId: "r9", columnId: "c1" })).toBe("?");
  });

  it("normalises a range whose corners are given backwards", () => {
    const grid = gridOf(body());
    const rect = rectOf(grid, { from: { rowId: "r3", columnId: "c3" }, to: { rowId: "r1", columnId: "c2" } });

    expect(rect).toEqual({ row: 0, column: 1, rows: 3, columns: 2 });
    expect(rectLabelOf(grid, rect!)).toBe("B1:C3");
  });

  it("clamps a rectangle that runs off the grid", () => {
    const grid = gridOf(body());

    expect(rangeOf(grid, { row: 1, column: 1, rows: 10, columns: 10 })).toEqual({
      from: { rowId: "r2", columnId: "c2" },
      to: { rowId: "r3", columnId: "c3" }
    });
    expect(refsIn(grid, { row: 2, column: 2, rows: 3, columns: 3 })).toEqual([{ rowId: "r3", columnId: "c3" }]);
  });

  it("parses A1 text, with or without dollar signs, into ids", () => {
    const grid = gridOf(body());

    expect(parseRef(grid, "$B$3")).toEqual({ rowId: "r3", columnId: "c2" });
    expect(parseRef(grid, "D1")).toBeUndefined();
    expect(parseRange(grid, "A1:B2")).toEqual({ from: { rowId: "r1", columnId: "c1" }, to: { rowId: "r2", columnId: "c2" } });
    expect(parseRange(grid, "A1:B2:C3")).toBeUndefined();
  });
});
