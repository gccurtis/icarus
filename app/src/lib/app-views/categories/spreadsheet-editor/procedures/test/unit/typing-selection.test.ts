import { describe, expect, it } from "vitest";
import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { factsOf, shownOf } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { rangeSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
import { typedSelection, writingAnchor, writingTargets } from "$app-views/categories/spreadsheet-editor/procedures/typing-selection";

const sheet: LiveSheet = {
  body: {
    rows: Array.from({ length: 4 }, (_, n) => ({ id: `r${n + 1}`, order: n })),
    columns: Array.from({ length: 4 }, (_, n) => ({ id: `c${n + 1}`, order: n })),
    rowPartCounts: [4], formatRules: [],
    styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
    print: { page: { paper: "letter", orientation: "portrait", margins: { top: 1, bottom: 1, left: 1, right: 1 } } }
  },
  cells: {}
};
const grid = gridOf(sheet.body);
const facts = factsOf("spreadsheets:1", sheet);

describe("typing into selected ranges", () => {
  it("keeps the starting corner and targets every selected cell exactly once", () => {
    const selection = rangeSignal(grid, [
      { row: 1, column: 1, rows: 2, columns: 2 },
      { row: 2, column: 2, rows: 2, columns: 2 }
    ], [2, 2])!.selection;
    expect(writingAnchor(selection)).toEqual({ rowId: "r3", columnId: "c3" });
    const targets = writingTargets(grid, selection);
    expect(targets).toHaveLength(7);
    const next = applyOps(sheet, typedSelection(sheet, grid, targets, "42", facts).ops);
    expect(Object.keys(next.cells)).toHaveLength(7);
    expect(Object.values(next.cells).every((cell) => cell.value.kind === "number" && cell.value.value === 42)).toBe(true);
    expect(next.cells["r1/c1"]).toBeUndefined();
  });

  it("stores the entered expression and its locks in every destination", () => {
    const targets = writingTargets(grid, { kind: "range", id: "r2/c2", at: "r3/c3" });
    const expression = "=SUM($A$1:$A$4)";
    const edit = typedSelection(sheet, grid, targets, expression, facts);
    expect(edit.refused).toBeUndefined();
    const next = applyOps(sheet, edit.ops);
    expect(Object.keys(next.cells)).toHaveLength(4);
    for (const cell of Object.values(next.cells)) {
      expect(shownOf(facts, cell)).toBe(expression);
    }
  });

  it("refuses the entire edit when one destination is protected by a spill", () => {
    const spilling: LiveSheet = { ...sheet, cells: {
      "r1/c1": { rowId: "r1", columnId: "c1", value: { kind: "number", value: 1 }, spillTo: { rowId: "r2", columnId: "c1" } },
      "r2/c1": { rowId: "r2", columnId: "c1", value: { kind: "number", value: 2 } }
    } };
    const targets = writingTargets(grid, { kind: "range", id: "r2/c1", at: "r2/c2" });
    const edit = typedSelection(spilling, grid, targets, "overwrite", facts);
    expect(edit.refused).toBeDefined();
    expect(edit.ops).toEqual([]);
  });
});
