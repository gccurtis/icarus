import { describe, expect, it } from "vitest";

import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import { hitsOf, replaceOps } from "$app-views/categories/spreadsheet-editor/procedures/find";
import { alignOf, paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
import { formulaRows, matchesFilter } from "$app-views/categories/spreadsheet-editor/procedures/formulas";
import { factsOf, shownOf, toStored } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { dependentsOf, precedentsOf, problemsOf, referencesIn } from "$app-views/categories/spreadsheet-editor/procedures/references";
import { runsOf, sceneOf } from "$app-views/categories/spreadsheet-editor/procedures/scene";
import {
  cellSignal,
  rangeSignal,
  rowSignal,
  selectedRects,
  surfaceSelectionOf,
  textRangeOf
} from "$app-views/categories/spreadsheet-editor/procedures/selecting";
import { aggregateOf, usedRect } from "$app-views/categories/spreadsheet-editor/procedures/stats";
import { appliedStyle, deletedStyle, styleRows } from "$app-views/categories/spreadsheet-editor/procedures/styles";

const body = (): SpreadsheetBody => ({
  rows: Array.from({ length: 5 }, (_, index) => ({ id: `r${index + 1}`, order: index + 1 })),
  columns: Array.from({ length: 4 }, (_, index) => ({ id: `c${index + 1}`, order: index + 1 })),
  rowPartCounts: [5],
  formatRules: [
    { id: "f1", from: { rowId: "r1", columnId: "c1" }, to: { rowId: "r1", columnId: "c4" }, style: "header" },
    { id: "f2", from: { rowId: "r2", columnId: "c2" }, to: { rowId: "r4", columnId: "c2" }, format: { valueFormat: "#,##0" } }
  ],
  frozenColumns: 1,
  print: { page: { paper: "letter", orientation: "portrait", margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } } },
  styles: {
    styles: { body: { name: "Body" }, header: { name: "Header", fontWeight: 600, horizontalAlignment: "center" } },
    defaultKey: "body"
  }
});

const grid = gridOf(body());
const facts = factsOf("spreadsheets:1", { body: body(), cells: {} }, "Sheet");

const stored = (text: string) => {
  const { formula, anchors } = toStored(text, facts);
  return { expression: formula, anchors: [...anchors] };
};

const sheet = (): LiveSheet => ({
  body: body(),
  cells: {
    "r1/c1": { rowId: "r1", columnId: "c1", value: { kind: "text", value: "Feeder" } },
    "r2/c1": {
      rowId: "r2",
      columnId: "c1",
      value: { kind: "text", value: "F-12" },
      marks: [{ id: "m1", from: { atom: "text", offset: 0 }, to: { atom: "text", offset: 1 }, style: ["bold"] }]
    },
    "r2/c2": { rowId: "r2", columnId: "c2", value: { kind: "number", value: 1842000 } },
    "r3/c2": { rowId: "r3", columnId: "c2", value: { kind: "number", value: 318400 } },
    "r4/c2": { rowId: "r4", columnId: "c2", value: { kind: "number", value: 2160400 }, ...stored("=SUM(B2:B3)") },
    "r4/c3": {
      rowId: "r4",
      columnId: "c3",
      value: { kind: "empty" },
      ...stored("=B4/eventCount"),
      failure: { token: "#NAME?", word: "eventCount" }
    },
    "r5/c3": { rowId: "r5", columnId: "c3", value: { kind: "number", value: 0.5 }, ...stored("=B4/1000+IF(TRUE,1,0)") }
  }
});

describe("paint", () => {
  it("layers the default style, the rules in order and the cell's own format", () => {
    const held = sheet();
    const header = paintOf(held.body, grid, { rowId: "r1", columnId: "c1" }, held.cells["r1/c1"]);
    expect(header.styleKey).toBe("header");
    expect(alignOf(header, "text")).toBe("center");

    const number = paintOf(held.body, grid, { rowId: "r2", columnId: "c2" }, held.cells["r2/c2"]);
    expect(number.styleKey).toBe("body");
    expect(number.format.valueFormat).toBe("#,##0");
    expect(alignOf(number, "number")).toBe("right");
  });
});

describe("the scene", () => {
  it("projects tracks, formatted text, tones and marks the surface can draw", () => {
    const scene = sceneOf(sheet(), grid, new Map(), facts);

    expect(scene.columns.map((column) => column.label)).toEqual(["A", "B", "C", "D"]);
    expect(scene.frozenColumns).toBe(1);
    expect(scene.cellAt(1, 1)).toMatchObject({ text: "1,842,000", raw: "1842000", align: "right", valign: "middle", tone: "plain", spilled: false });
    expect(scene.cellAt(3, 1)).toMatchObject({ text: "2,160,400", raw: "=SUM(B2:B3)", tone: "formula" });
    expect(scene.cellAt(3, 2)).toMatchObject({
      text: "#NAME?",
      raw: "=B4/eventCount",
      tone: "error"
    });
    expect(scene.cellAt(0, 0)).toMatchObject({ weight: 600, align: "center" });
    expect(scene.cellAt(1, 0).runs).toEqual([
      { text: "F", bold: true, italic: false, underline: false, strike: false, code: false, color: undefined },
      { text: "-12", bold: false, italic: false, underline: false, strike: false, code: false, color: undefined }
    ]);
    expect(scene.cellAt(9, 9)).toMatchObject({ text: "", readonly: true });
  });

  it("splits text into runs at every mark edge", () => {
    expect(
      runsOf("Ward 3", [{ id: "m", from: { atom: "text", offset: 5 }, to: { atom: "text", offset: 6 }, color: "--token-color-danger-text" }]).map((run) => [run.text, run.color])
    ).toEqual([
      ["Ward ", undefined],
      ["3", "--token-color-danger-text"]
    ]);
  });
});

describe("references", () => {
  it("scans cells, ranges and broken tokens out of an expression", () => {
    const reads = referencesIn(facts, {
      rowId: "r5",
      columnId: "c4",
      value: { kind: "empty" },
      ...stored("=B4+SUM(A1:B2)+B9")
    });

    expect(reads.map((reference) => [reference.text, reference.kind])).toEqual([
      ["B4", "cell"],
      ["A1:B2", "range"],
      ["#REF!", "broken"]
    ]);
  });

  it("lists what a cell reads and what reads it", () => {
    const held = sheet();

    expect(precedentsOf(held, facts, { rowId: "r4", columnId: "c2" }).map((dependency) => dependency.ref.rowId)).toEqual(["r2", "r3"]);
    expect(dependentsOf(held, facts, { rowId: "r2", columnId: "c2" }).map((dependency) => dependency.ref)).toEqual([{ rowId: "r4", columnId: "c2" }]);
    expect(dependentsOf(held, facts, { rowId: "r4", columnId: "c2" }).map((dependency) => dependency.ref.columnId)).toEqual(["c3", "c3"]);
  });

  it("explains a problem by the name it could not find", () => {
    const [problem] = problemsOf(sheet(), grid);

    expect(problem.error).toBe("#NAME?");
    expect(problem.explanation).toMatch(/eventCount/);
  });
});

describe("find", () => {
  it("searches what a cell shows or, for a formula, what it says, ordered by position", () => {
    expect(hitsOf(sheet(), grid, "b4", false, facts).map((hit) => `${hit.label}:${hit.inExpression}`)).toEqual(["C4:true", "C5:true"]);
    expect(hitsOf(sheet(), grid, "F-1", true, facts).map((hit) => hit.label)).toEqual(["A2"]);
    expect(hitsOf(sheet(), grid, "f-1", true, facts)).toEqual([]);
    expect(hitsOf(sheet(), grid, "", false, facts)).toEqual([]);
    expect(hitsOf(sheet(), grid, "eed", false, facts)[0]).toMatchObject({ before: "F", match: "eed", after: "er" });
  });

  it("replaces inside a value or an expression through the same write a person would make", () => {
    const held = sheet();
    const hits = hitsOf(held, grid, "B3", false, facts);
    const ops = replaceOps(held, grid, hits, "B5", facts);
    const next = applyOps(held, ops);

    expect(shownOf(facts, next.cells["r4/c2"])).toBe("=SUM(B2:B5)");
  });
});

describe("formula rows", () => {
  it("list every formula cell in grid order with what it shows and whether it is broken", () => {
    const rows = formulaRows(sheet(), facts);

    expect(rows.map((row) => `${row.label}:${row.error ?? "ok"}`)).toEqual(["B4:ok", "C4:#NAME?", "C5:ok"]);
    expect(rows[0].shows).toBe("2,160,400");
    expect(rows.filter((row) => matchesFilter(row, "c5")).map((row) => row.label)).toEqual(["C5"]);
    expect(rows.filter((row) => matchesFilter(row, "eventCount")).map((row) => row.label)).toEqual(["C4"]);
  });
});

describe("selection signals", () => {
  it("name the lens by what is at the coordinate", () => {
    const held = sheet();

    expect(cellSignal(held, grid, { rowId: "r2", columnId: "c2" }).key).toBe("spreadsheet-editor.cell");
    expect(cellSignal(held, grid, { rowId: "r4", columnId: "c2" }).key).toBe("spreadsheet-editor.cell-with-formula");
    expect(cellSignal(held, grid, { rowId: "r4", columnId: "c3" }).key).toBe("spreadsheet-editor.error-cell");
    expect(cellSignal(held, grid, { rowId: "r5", columnId: "c1" })).toEqual({ key: "spreadsheet-editor.cell", selection: { kind: "cell", id: "r5/c1" } });
  });

  it("carry ranges and rows as corner pairs and read them back as rectangles", () => {
    const range = rangeSignal(grid, [{ row: 1, column: 1, rows: 3, columns: 1 }, { row: 0, column: 3, rows: 1, columns: 1 }]);
    expect(range?.selection).toEqual({ kind: "range", id: "r2/c2", at: "r4/c2", ranges: [{ id: "r1/c4", at: "r1/c4" }] });
    expect(selectedRects(grid, range?.selection)).toEqual([
      { row: 1, column: 1, rows: 3, columns: 1 },
      { row: 0, column: 3, rows: 1, columns: 1 }
    ]);

    const rows = rowSignal(grid, [3, 1]);
    expect(rows?.selection).toEqual({ kind: "row", id: "r2", ranges: [{ id: "r4", at: "r4" }] });
    expect(surfaceSelectionOf(grid, rows?.selection)).toEqual({ ranges: [], rows: [1, 3], columns: [] });
  });

  it("keep the corner a drag started from, so a drag upwards reads back the same way", () => {
    const reversed = rangeSignal(grid, [{ row: 1, column: 1, rows: 3, columns: 1 }], [1, 3]);
    expect(reversed?.selection).toEqual({ kind: "range", id: "r4/c2", at: "r2/c2" });
    expect(selectedRects(grid, reversed?.selection)).toEqual([{ row: 1, column: 1, rows: 3, columns: 1 }]);
    expect(surfaceSelectionOf(grid, reversed?.selection)?.cell).toEqual([1, 3]);
  });

  it("read a text selection back to its cell and offsets", () => {
    expect(textRangeOf({ kind: "text-selection", id: "r2/c1@3", at: "r2/c1@0" })).toEqual({ ref: { rowId: "r2", columnId: "c1" }, from: 0, to: 3 });
  });
});

describe("stats and styles", () => {
  it("bound the used range and total the numbers in a selection", () => {
    const held = sheet();

    expect(usedRect(held, grid)).toEqual({ row: 0, column: 0, rows: 5, columns: 3 });
    expect(aggregateOf(held, grid, [{ row: 1, column: 1, rows: 3, columns: 1 }])).toMatchObject({ cells: 3, filled: 3, numbers: 3, sum: 4320800 });
  });

  it("name every style, and write a rule to apply one", () => {
    const held = sheet();
    const rows = styleRows(held);

    expect(rows.find((row) => row.key === "header")).toMatchObject({ shorthand: "600 · centred", isDefault: false });
    expect(rows.find((row) => row.key === "body")).toMatchObject({ isDefault: true });

    const [op] = appliedStyle(held.body, grid, [{ row: 1, column: 0, rows: 2, columns: 1 }], "header");
    expect(op).toMatchObject({ op: "insert", target: "formatRule", values: [{ from: { rowId: "r2", columnId: "c1" }, to: { rowId: "r3", columnId: "c1" }, style: "header" }] });

    const same = appliedStyle(held.body, grid, [{ row: 0, column: 0, rows: 1, columns: 4 }], "body");
    expect(same).toEqual([{ op: "set", target: "formatRule", path: "formatRules/f1/style", value: "body", was: "header" }]);
  });

  it("refuse to delete the default style or one a rule still names", () => {
    expect(deletedStyle(sheet().body, "body").refused).toMatch(/default/);
    expect(deletedStyle(sheet().body, "header").refused).toMatch(/rule/);
  });
});
