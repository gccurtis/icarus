import { describe, expect, it } from "vitest";

import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { referencesIn, sheetNamed } from "$app-views/categories/spreadsheet-editor/procedures/references";
import {
  duplicatedColumns,
  duplicatedRows,
  fittedColumn,
  fittedRow
} from "$app-views/categories/spreadsheet-editor/procedures/structure";
import { pixelsOf, pointsOf } from "$app-views/categories/spreadsheet-editor/procedures/units";

const sheet = (): LiveSheet => ({
  body: {
    rows: [
      { id: "r1", order: 1, height: 40 },
      { id: "r2", order: 2 },
      { id: "r3", order: 3 }
    ],
    columns: [
      { id: "c1", order: 1, width: 160 },
      { id: "c2", order: 2 }
    ],
    rowPartCounts: [3],
    formatRules: [{ id: "f1", from: { rowId: "r1", columnId: "c1" }, to: { rowId: "r1", columnId: "c2" }, style: "title" }],
    print: { page: { paper: "letter", orientation: "portrait", margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } } },
    styles: { styles: { body: { name: "Body" }, title: { name: "Title", fontSize: 24 } }, defaultKey: "body" }
  },
  cells: {
    "r1/c1": { rowId: "r1", columnId: "c1", value: { kind: "text", value: "Outage minutes by substation" } },
    "r2/c1": { rowId: "r2", columnId: "c1", value: { kind: "text", value: "Ashgrove" }, format: { bold: true } },
    "r2/c2": { rowId: "r2", columnId: "c2", value: { kind: "number", value: 4180 }, expression: "=SUM(A1:A1)" }
  }
});

const grid = gridOf(sheet().body);

describe("duplicating tracks", () => {
  it("copies a row's cells and height into a new row placed after it", () => {
    const held = sheet();
    const ops = duplicatedRows(held, grid, ["r2"]);
    const next = applyOps(held, ops);

    expect(next.body.rows).toHaveLength(4);
    expect(next.body.rows[2].id).not.toBe("r3");
    const copy = next.body.rows[2].id;
    expect(next.cells[`${copy}/c1`]).toMatchObject({ value: { kind: "text", value: "Ashgrove" }, format: { bold: true } });
    expect(next.cells[`${copy}/c2`]).toMatchObject({ expression: "=SUM(A1:A1)" });
  });

  it("copies a column's cells and width into a new column placed after it", () => {
    const held = sheet();
    const next = applyOps(held, duplicatedColumns(held, grid, ["c1"]));

    expect(next.body.columns).toHaveLength(3);
    expect(next.body.columns[1].width).toBe(160);
    expect(next.cells[`r1/${next.body.columns[1].id}`]).toMatchObject({ value: { kind: "text", value: "Outage minutes by substation" } });
  });
});

describe("fitting tracks to their content", () => {
  it("widens a column to its longest value and grows a row to its largest type", () => {
    const held = sheet();
    expect(fittedColumn(held, grid, "c1")).toMatchObject({ path: "columns/c1/width" });
    expect((fittedColumn(held, grid, "c1") as { value: number }).value).toBeGreaterThan(160);
    expect(fittedRow(held, grid, "r1")).toMatchObject({ path: "rows/r1/height", value: 42 });
    expect(fittedRow(held, grid, "r2")).toBeUndefined();
  });

  it("converts between points and pixels both ways", () => {
    expect(pointsOf(112)).toBe(84);
    expect(pixelsOf(84)).toBe(112);
    expect(pointsOf(26)).toBe(19.5);
  });
});

describe("references to other sheets", () => {
  it("reads quoted and bare sheet names and finds the sheet by title", () => {
    const found = referencesIn(grid, "='Hardening cost model'!B4+Rates!C2");
    expect(found).toEqual([
      { text: "'Hardening cost model'!B4", kind: "external", sheet: "Hardening cost model", address: "B4" },
      { text: "Rates!C2", kind: "external", sheet: "Rates", address: "C2" }
    ]);
    const sheets = [{ _id: "spreadsheets:2", title: "Hardening cost model" }];
    expect(sheetNamed(sheets, "hardening cost model")?._id).toBe("spreadsheets:2");
    expect(sheetNamed(sheets, "Rates")).toBeUndefined();
  });
});
