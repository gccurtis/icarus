import { describe, expect, it } from "vitest";

import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { cleared, typed } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import { pasted } from "$app-views/categories/spreadsheet-editor/procedures/clipboard";
import { filled } from "$app-views/categories/spreadsheet-editor/procedures/fill";
import { factsOf, shownOf, toStored } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { merged, unmerged } from "$app-views/categories/spreadsheet-editor/procedures/spans";
import {
  frozenColumnsSet,
  insertedRows,
  movedColumn,
  movedRow,
  removedRows,
  resizedColumn
} from "$app-views/categories/spreadsheet-editor/procedures/structure";

const body = (): SpreadsheetBody => ({
  rows: Array.from({ length: 6 }, (_, index) => ({ id: `r${index + 1}`, order: index + 1 })),
  columns: Array.from({ length: 4 }, (_, index) => ({ id: `c${index + 1}`, order: index + 1, width: 100 })),
  rowPartCounts: [6],
  formatRules: [{ id: "f1", from: { rowId: "r1", columnId: "c1" }, to: { rowId: "r1", columnId: "c4" }, style: "header" }],
  print: { page: { paper: "letter", orientation: "portrait", margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } } },
  styles: { styles: { body: { name: "Body" }, header: { name: "Header", fontWeight: 600 } }, defaultKey: "body" }
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
    "r1/c1": { rowId: "r1", columnId: "c1", value: { kind: "text", value: "Substation" } },
    "r2/c1": { rowId: "r2", columnId: "c1", value: { kind: "text", value: "Tier 1" } },
    "r2/c2": { rowId: "r2", columnId: "c2", value: { kind: "number", value: 2 } },
    "r3/c2": { rowId: "r3", columnId: "c2", value: { kind: "number", value: 4 } },
    "r2/c3": { rowId: "r2", columnId: "c3", value: { kind: "number", value: 10 }, ...stored("=B2*5") },
    "r4/c1": {
      rowId: "r4",
      columnId: "c1",
      value: { kind: "text", value: "Tier 1" },
      ...stored("=UNIQUE(A2:A3)"),
      spillTo: { rowId: "r5", columnId: "c1" }
    },
    "r5/c1": { rowId: "r5", columnId: "c1", value: { kind: "text", value: "Tier 2" } },
    "r6/c4": { rowId: "r6", columnId: "c4", value: { kind: "number", value: 1 }, format: { valueFormat: "#,##0" } }
  }
});

describe("typing into a cell", () => {
  it("writes a number into an empty coordinate as one whole-cell set", () => {
    const edit = typed(sheet(), grid, { rowId: "r3", columnId: "c3" }, "42", facts);

    expect(edit.ops).toEqual([
      { op: "set", target: "cell", path: "r3/c3", value: { value: { kind: "number", value: 42 } }, was: null }
    ]);
  });

  it("replaces a value and drops the expression it had", () => {
    const edit = typed(sheet(), grid, { rowId: "r2", columnId: "c3" }, "11", facts);

    expect(edit.ops.map((op) => op.path)).toEqual(["r2/c3/value", "r2/c3/expression", "r2/c3/anchors"]);
    expect(applyOps(sheet(), edit.ops).cells["r2/c3"]).toEqual({ rowId: "r2", columnId: "c3", value: { kind: "number", value: 11 } });
  });

  it("stores a formula as an expression and leaves the value to the engine", () => {
    const edit = typed(sheet(), grid, { rowId: "r3", columnId: "c3" }, "=B3*5", facts);

    expect(applyOps(sheet(), edit.ops).cells["r3/c3"]).toEqual({
      rowId: "r3",
      columnId: "c3",
      value: { kind: "empty" },
      ...stored("=B3*5")
    });
  });

  it("writes nothing when the text is what the cell already holds", () => {
    expect(typed(sheet(), grid, { rowId: "r2/c2".split("/")[0], columnId: "c2" }, "2", facts).ops).toEqual([]);
    expect(typed(sheet(), grid, { rowId: "r2", columnId: "c3" }, "=B2*5", facts).ops).toEqual([]);
  });

  it("refuses a spill child and names the origin", () => {
    const edit = typed(sheet(), grid, { rowId: "r5", columnId: "c1" }, "x", facts);

    expect(edit.ops).toEqual([]);
    expect(edit.refused).toMatch(/A5 is filled by A4/);
  });

  it("clears a plain cell whole and a formatted cell down to its shell", () => {
    const plain = cleared(sheet(), grid, [{ rowId: "r2", columnId: "c2" }]);
    expect(plain.ops).toEqual([{ op: "set", target: "cell", path: "r2/c2", value: null, was: sheet().cells["r2/c2"] }]);

    const shell = applyOps(sheet(), cleared(sheet(), grid, [{ rowId: "r6", columnId: "c4" }]).ops);
    expect(shell.cells["r6/c4"]).toEqual({ rowId: "r6", columnId: "c4", value: { kind: "empty" }, format: { valueFormat: "#,##0" } });
  });

  it("leaves spill children alone when clearing a block", () => {
    const edit = cleared(sheet(), grid, [{ rowId: "r5", columnId: "c1" }, { rowId: "r2", columnId: "c1" }]);

    expect(edit.skipped).toBe(1);
    expect(edit.ops.map((op) => op.path)).toEqual(["r2/c1"]);
  });
});

describe("the fill handle", () => {
  it("continues a numeric series down a column", () => {
    const edit = filled(sheet(), grid, { row: 1, column: 1, rows: 2, columns: 1 }, { row: 3, column: 1, rows: 3, columns: 1 });

    const next = applyOps(sheet(), edit.ops);
    expect([next.cells["r4/c2"], next.cells["r5/c2"], next.cells["r6/c2"]].map((cell) => cell?.value)).toEqual([
      { kind: "number", value: 6 },
      { kind: "number", value: 8 },
      { kind: "number", value: 10 }
    ]);
    expect(edit.summary).toMatch(/^Series/);
  });

  it("counts a trailing number and repeats a single value", () => {
    const counted = filled(sheet(), grid, { row: 1, column: 0, rows: 1, columns: 1 }, { row: 2, column: 0, rows: 1, columns: 1 });
    expect(applyOps(sheet(), counted.ops).cells["r3/c1"]?.value).toEqual({ kind: "text", value: "Tier 2" });

    const repeated = filled(sheet(), grid, { row: 0, column: 0, rows: 1, columns: 1 }, { row: 0, column: 1, rows: 1, columns: 2 });
    expect(applyOps(sheet(), repeated.ops).cells["r1/c3"]?.value).toEqual({ kind: "text", value: "Substation" });
  });

  it("fills a formula by shifting every reference in it", () => {
    const edit = filled(sheet(), grid, { row: 1, column: 2, rows: 1, columns: 1 }, { row: 2, column: 2, rows: 2, columns: 1 });
    const next = applyOps(sheet(), edit.ops);

    expect(edit.refused).toBeUndefined();
    expect(shownOf(facts, next.cells["r3/c3"])).toBe("=B3*5");
    expect(shownOf(facts, next.cells["r4/c3"])).toBe("=B4*5");
  });
});

describe("paste", () => {
  it("parses a block the way typing does and anchors it at the target", () => {
    const edit = pasted(sheet(), grid, { row: 2, column: 2 }, [["7", "=A1"], ["TRUE", ""]], facts);

    const next = applyOps(sheet(), edit.ops);
    expect(next.cells["r3/c3"]?.value).toEqual({ kind: "number", value: 7 });
    expect(shownOf(facts, next.cells["r3/c4"])).toBe("=A1");
    expect(next.cells["r4/c3"]?.value).toEqual({ kind: "logic", value: true });
    expect(next.cells["r4/c4"]).toBeUndefined();
  });

  it("grows the grid when the block runs past the last row", () => {
    const edit = pasted(sheet(), grid, { row: 5, column: 0 }, [["a"], ["b"], ["c"]], facts);

    const next = applyOps(sheet(), edit.ops);
    expect(next.body.rows).toHaveLength(8);
    expect(edit.summary).toMatch(/grew/);
  });

  it("fills a whole selection with one value and refuses a spill", () => {
    const filledIn = pasted(sheet(), grid, { row: 1, column: 3 }, [["9"]], facts, { row: 1, column: 3, rows: 2, columns: 1 });
    expect(filledIn.ops).toHaveLength(2);

    const refused = pasted(sheet(), grid, { row: 4, column: 0 }, [["x"]], facts);
    expect(refused.refused).toMatch(/spill/);
  });
});

describe("merging", () => {
  it("clears the covered cells and marks the anchor, and undoes both", () => {
    const before = sheet();
    const edit = merged(before, grid, { row: 1, column: 0, rows: 1, columns: 2 });

    expect(edit.cleared).toBe(1);
    const after = applyOps(before, edit.ops);
    expect(after.cells["r2/c1"]?.mergedTo).toEqual({ rowId: "r2", columnId: "c2" });
    expect(after.cells["r2/c2"]).toBeUndefined();

    const back = applyOps(after, unmerged(after, { rowId: "r2", columnId: "c1" }).ops);
    expect(back.cells["r2/c1"]?.mergedTo).toBeUndefined();
  });

  it("refuses a range that crosses a spill", () => {
    expect(merged(sheet(), grid, { row: 3, column: 0, rows: 2, columns: 2 }).refused).toMatch(/spill/);
  });
});

describe("rows and columns", () => {
  it("removes rows carrying their cells, with a predecessor each op can be undone against", () => {
    const ops = removedRows(sheet(), grid, ["r2", "r3"]);

    expect(ops.map((op) => (op.op === "remove" ? op.after : null))).toEqual(["r1", "r1"]);
    const after = applyOps(sheet(), ops);
    expect(after.body.rows.map((row) => row.id)).toEqual(["r1", "r4", "r5", "r6"]);
    expect(Object.keys(after.cells)).not.toContain("r2/c2");
  });

  it("moves a row to where the grid dropped it", () => {
    const op = movedRow(grid, 0, 2);
    const after = applyOps(sheet(), op === undefined ? [] : [op]);

    expect(after.body.rows.map((row) => row.id)).toEqual(["r2", "r3", "r1", "r4", "r5", "r6"]);
    expect(movedColumn(grid, 3, 0)).toMatchObject({ id: "c4", after: null, wasAfter: "c3" });
  });

  it("inserts, resizes and freezes through the sheet target", () => {
    const inserted = insertedRows("r6", 2);
    expect(applyOps(sheet(), inserted.ops).body.rows).toHaveLength(8);

    expect(resizedColumn(grid, "c1", 140)).toMatchObject({ path: "columns/c1/width", value: 140, was: 100 });
    expect(resizedColumn(grid, "c1", 100)).toBeUndefined();
    expect(frozenColumnsSet(sheet().body, 1)).toMatchObject({ path: "frozenColumns", value: 1, was: null });
    expect(frozenColumnsSet(sheet().body, 0)).toBeUndefined();
  });
});
