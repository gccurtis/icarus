import { describe, expect, it } from "vitest";

import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { typed } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import { datumOf, evaluate, recalculated, withRecalculation } from "$app-views/categories/spreadsheet-editor/procedures/evaluate";

const sheet = (): LiveSheet => ({
  body: {
    rows: Array.from({ length: 8 }, (_, index) => ({ id: `r${index + 1}`, order: index + 1 })),
    columns: Array.from({ length: 4 }, (_, index) => ({ id: `c${index + 1}`, order: index + 1 })),
    rowPartCounts: [8],
    formatRules: [],
    print: { page: { paper: "letter", orientation: "portrait", margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } } },
    styles: { styles: { body: { name: "Body" } }, defaultKey: "body" }
  },
  cells: {
    "r1/c1": { rowId: "r1", columnId: "c1", value: { kind: "number", value: 10 } },
    "r2/c1": { rowId: "r2", columnId: "c1", value: { kind: "number", value: 4 } },
    "r3/c1": { rowId: "r3", columnId: "c1", value: { kind: "number", value: 6 } },
    "r1/c2": { rowId: "r1", columnId: "c2", value: { kind: "text", value: "Tier 1" } },
    "r2/c2": { rowId: "r2", columnId: "c2", value: { kind: "text", value: "Tier 2" } },
    "r3/c2": { rowId: "r3", columnId: "c2", value: { kind: "text", value: "Tier 1" } }
  }
});

const grid = gridOf(sheet().body);

const answer = (expression: string, held: LiveSheet = sheet()) =>
  evaluate(expression, grid, (ref) => datumOf(held.cells[`${ref.rowId}/${ref.columnId}`]));

describe("evaluating an expression", () => {
  it("does arithmetic over cells, with precedence and parentheses", () => {
    expect(answer("=A1*2")).toEqual({ kind: "value", value: 20 });
    expect(answer("=A1+A2*2")).toEqual({ kind: "value", value: 18 });
    expect(answer("=(A1+A2)*2")).toEqual({ kind: "value", value: 28 });
    expect(answer("=A1*60/A3")).toEqual({ kind: "value", value: 100 });
    expect(answer("=-A2^2")).toEqual({ kind: "value", value: 16 });
    expect(answer("=0-A2^2")).toEqual({ kind: "value", value: -16 });
    expect(answer("=A1*10%")).toEqual({ kind: "value", value: 1 });
  });

  it("runs the functions the builder offers", () => {
    expect(answer("=SUM(A1:A3)")).toEqual({ kind: "value", value: 20 });
    expect(answer("=MEAN(A1:A3)")).toMatchObject({ value: 20 / 3 });
    expect(answer("=MEDIAN(A1:A3)")).toEqual({ kind: "value", value: 6 });
    expect(answer("=ROUND(1.845, 2)")).toEqual({ kind: "value", value: 1.85 });
    expect(answer("=ABS(0-A2)")).toEqual({ kind: "value", value: 4 });
    expect(answer("=COUNT(A1:B3)")).toEqual({ kind: "value", value: 3 });
    expect(answer('=COUNTIF(B1:B3,"Tier 1")')).toEqual({ kind: "value", value: 2 });
    expect(answer('=IF(A1>A2,"over","under")')).toEqual({ kind: "value", value: "over" });
    expect(answer('=CONCAT(B1," · ",A1)')).toEqual({ kind: "value", value: "Tier 1 · 10" });
    expect(answer("=UPPER(B1)")).toEqual({ kind: "value", value: "TIER 1" });
    expect(answer("=PERCENTILE(A1:A3, 0.5)")).toEqual({ kind: "value", value: 6 });
  });

  it("answers with the error a spreadsheet would show", () => {
    expect(answer("=A1/0")).toEqual({ kind: "error", error: "#DIV/0!" });
    expect(answer("=SUMM(A1:A3)")).toEqual({ kind: "error", error: "#NAME?" });
    expect(answer("=A1+")).toEqual({ kind: "error", error: "#ERROR!" });
    expect(answer("=Z99+1")).toEqual({ kind: "error", error: "#REF!" });
    expect(answer("=B1*2")).toEqual({ kind: "error", error: "#VALUE!" });
    expect(answer("=rates+1")).toEqual({ kind: "error", error: "#NAME?" });
  });

  it("leaves what it cannot answer for alone", () => {
    expect(answer("='Hardening cost model'!E10")).toEqual({ kind: "unsupported" });
    expect(answer("=UNIQUE(B1:B3)")).toEqual({ kind: "unsupported" });
  });
});

describe("recalculating a sheet", () => {
  it("writes each formula's value in dependency order", () => {
    const held = applyOps(sheet(), [
      { op: "set", target: "cell", path: "r5/c1", value: { value: { kind: "empty" }, expression: "=SUM(A1:A3)" }, was: null },
      { op: "set", target: "cell", path: "r6/c1", value: { value: { kind: "empty" }, expression: "=A5*2" }, was: null }
    ]);

    const next = applyOps(held, recalculated(held, grid));
    expect(next.cells["r5/c1"].value).toEqual({ kind: "number", value: 20 });
    expect(next.cells["r6/c1"].value).toEqual({ kind: "number", value: 40 });
  });

  it("marks a formula that depends on itself", () => {
    const held = applyOps(sheet(), [
      { op: "set", target: "cell", path: "r5/c1", value: { value: { kind: "empty" }, expression: "=A6+1" }, was: null },
      { op: "set", target: "cell", path: "r6/c1", value: { value: { kind: "empty" }, expression: "=A5+1" }, was: null }
    ]);

    const next = applyOps(held, recalculated(held, grid));
    expect(next.cells["r5/c1"].value).toEqual({ kind: "text", value: "#CYCLE!" });
    expect(next.cells["r6/c1"].value).toEqual({ kind: "text", value: "#CYCLE!" });
  });

  it("carries a typed formula and its consequences in one change", () => {
    const held = sheet();
    const edit = typed(held, grid, { rowId: "r5", columnId: "c1" }, "=A1*2");
    const next = applyOps(held, withRecalculation(held, edit.ops));

    expect(next.cells["r5/c1"]).toMatchObject({ expression: "=A1*2", value: { kind: "number", value: 20 } });
  });

  it("follows an edit through to the formulas that read it", () => {
    const held = applyOps(sheet(), [
      { op: "set", target: "cell", path: "r5/c1", value: { value: { kind: "number", value: 20 }, expression: "=SUM(A1:A3)" }, was: null }
    ]);
    const edit = typed(held, grid, { rowId: "r1", columnId: "c1" }, "30");
    const next = applyOps(held, withRecalculation(held, edit.ops));

    expect(next.cells["r5/c1"].value).toEqual({ kind: "number", value: 40 });
  });
});
