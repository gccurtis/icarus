import { describe, expect, it } from "vitest";

import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import { recalculated, sourceOf, withRecalculation, type Surroundings } from "$representation/data/behavior/spreadsheets/formulas";
import { toStored } from "$representation/data/behavior/spreadsheets/translation";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Id } from "$representation/data/types/core/id";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";

const SHEET = "spreadsheets:1" as Id<"spreadsheets">;

const body = (): SpreadsheetBody =>
  ({
    rows: Array.from({ length: 12 }, (_, index) => ({ id: `r${index + 1}`, order: index + 1 })),
    columns: Array.from({ length: 6 }, (_, index) => ({ id: `c${index + 1}`, order: index + 1 })),
    rowPartCounts: [],
    formatRules: [],
    print: { page: {} },
    styles: {}
  }) as unknown as SpreadsheetBody;

const number = (value: number): FormulaValue => ({ kind: "number", value });

const facts = { resourceId: SHEET, title: "Sheet", grid: sourceOf(SHEET, { body: body(), cells: {} }).grid };

const sheetOf = (cells: Readonly<Record<string, Partial<SheetCell>>>): LiveSheet => {
  const held: Record<string, SheetCell> = {};
  for (const [key, cell] of Object.entries(cells)) {
    const [rowId, columnId] = key.split("/");
    held[key] = { rowId, columnId, value: { kind: "empty" }, ...cell } as SheetCell;
  }
  return { body: body(), cells: held };
};

const typed = (text: string): string => toStored(text, facts).formula;

const settled = (sheet: LiveSheet, around?: Surroundings): LiveSheet => {
  const source = sourceOf(SHEET, sheet);
  return applyOps(sheet, recalculated(source, around ?? {}));
};

describe("answering every formula in a sheet", () => {
  it("computes one cell from another", () => {
    const sheet = sheetOf({
      "r1/c1": { value: number(10) },
      "r2/c1": { expression: typed("=A1*2") }
    });
    expect(settled(sheet).cells["r2/c1"].value).toEqual(number(20));
  });

  it("follows a chain in dependency order rather than in key order", () => {
    const sheet = sheetOf({
      "r3/c1": { expression: typed("=A2+1") },
      "r2/c1": { expression: typed("=A1+1") },
      "r1/c1": { value: number(1) }
    });
    const next = settled(sheet);
    expect(next.cells["r2/c1"].value).toEqual(number(2));
    expect(next.cells["r3/c1"].value).toEqual(number(3));
  });

  it("sums a range and recomputes when a member changes", () => {
    const sheet = sheetOf({
      "r1/c1": { value: number(1) },
      "r2/c1": { value: number(2) },
      "r3/c1": { value: number(3) },
      "r4/c1": { expression: typed("=SUM(A1:A3)") }
    });
    expect(settled(sheet).cells["r4/c1"].value).toEqual(number(6));

    const changed = applyOps(sheet, [
      { op: "set", target: "cell", path: "r1/c1/value", value: number(10), was: number(1) }
    ]);
    expect(settled(changed).cells["r4/c1"].value).toEqual(number(15));
  });

  it("writes nothing when every answer is already the one held", () => {
    const sheet = settled(
      sheetOf({ "r1/c1": { value: number(4) }, "r2/c1": { expression: typed("=A1*2") } })
    );
    expect(recalculated(sourceOf(SHEET, sheet))).toEqual([]);
  });
});

describe("refusals", () => {
  it("keeps the value empty and says why beside it", () => {
    const sheet = settled(sheetOf({ "r1/c1": { expression: typed("=1/0") } }));
    expect(sheet.cells["r1/c1"].value).toEqual({ kind: "empty" });
    expect(sheet.cells["r1/c1"].failure).toEqual({ token: "#DIV/0!" });
  });

  it("carries a refusal into whatever reads it", () => {
    const sheet = settled(
      sheetOf({ "r1/c1": { expression: typed("=1/0") }, "r2/c1": { expression: typed("=A1+1") } })
    );
    expect(sheet.cells["r2/c1"].failure?.token).toBe("#DIV/0!");
  });

  it("names a word nothing defines", () => {
    const sheet = settled(sheetOf({ "r1/c1": { expression: typed("=widgets+1") } }));
    expect(sheet.cells["r1/c1"].failure).toEqual({ token: "#NAME?", word: "widgets" });
  });

  it("refuses an address off the grid", () => {
    const sheet = settled(sheetOf({ "r1/c1": { expression: typed("=Z99+1") } }));
    expect(sheet.cells["r1/c1"].failure?.token).toBe("#REF!");
  });

  it("marks every cell in a ring rather than one of them", () => {
    const sheet = settled(
      sheetOf({ "r1/c1": { expression: typed("=A2+1") }, "r2/c1": { expression: typed("=A1+1") } })
    );
    expect(sheet.cells["r1/c1"].failure).toEqual({ token: "#CYCLE!" });
    expect(sheet.cells["r2/c1"].failure).toEqual({ token: "#CYCLE!" });
  });

  it("clears a failure once the formula answers again", () => {
    const broken = settled(sheetOf({ "r1/c1": { value: number(0) }, "r2/c1": { expression: typed("=1/A1") } }));
    expect(broken.cells["r2/c1"].failure?.token).toBe("#DIV/0!");

    const mended = settled(
      applyOps(broken, [{ op: "set", target: "cell", path: "r1/c1/value", value: number(2), was: number(0) }])
    );
    expect(mended.cells["r2/c1"].failure).toBeUndefined();
    expect(mended.cells["r2/c1"].value).toEqual(number(0.5));
  });
});

describe("what a sheet can reach beyond itself", () => {
  it("answers a project name from the variables it was handed", () => {
    const around: Surroundings = { variable: (name) => (name === "rate" ? number(3) : undefined) };
    const sheet = settled(sheetOf({ "r1/c1": { value: number(4) }, "r2/c1": { expression: typed("=A1*rate") } }), around);
    expect(sheet.cells["r2/c1"].value).toEqual(number(12));
  });

  it("reads a cell in another sheet", () => {
    const other = sourceOf("spreadsheets:2" as Id<"spreadsheets">, sheetOf({ "r10/c5": { value: number(7) } }));
    const around: Surroundings = { sheetAt: (id) => (id === other.resourceId ? other : undefined) };
    const sheet = sheetOf({ "r1/c1": { expression: "=`cell|spreadsheets:2|r10|c5` * 2" } });
    expect(settled(sheet, around).cells["r1/c1"].value).toEqual(number(14));
  });

  it("reads a whole sheet as a table, taking its first row as the column names", () => {
    const other = sourceOf(
      "spreadsheets:2" as Id<"spreadsheets">,
      sheetOf({
        "r1/c1": { value: { kind: "text", value: "name" } },
        "r1/c2": { value: { kind: "text", value: "minutes" } },
        "r2/c1": { value: { kind: "text", value: "Ashgrove" } },
        "r2/c2": { value: number(1610) },
        "r3/c1": { value: { kind: "text", value: "Coldwater" } },
        "r3/c2": { value: number(2985) }
      })
    );
    const around: Surroundings = { sheetAt: (id) => (id === other.resourceId ? other : undefined) };
    const sheet = sheetOf({ "r1/c1": { expression: "=SUM(`resource|spreadsheet|spreadsheets:2`.minutes)" } });
    expect(settled(sheet, around).cells["r1/c1"].value).toEqual(number(4595));
  });
});

describe("an edit and its consequences", () => {
  it("comes back as one array, so undo takes both", () => {
    const sheet = sheetOf({ "r1/c1": { value: number(1) }, "r2/c1": { expression: typed("=A1*2") } });
    const source = sourceOf(SHEET, settled(sheet));
    const ops = withRecalculation(source, [
      { op: "set", target: "cell", path: "r1/c1/value", value: number(5), was: number(1) }
    ]);
    expect(ops.length).toBeGreaterThan(1);
    expect(applyOps(source.sheet, ops).cells["r2/c1"].value).toEqual(number(10));
  });

  it("passes an edit through untouched when it cannot be applied", () => {
    const source = sourceOf(SHEET, sheetOf({}));
    const ops = withRecalculation(source, [
      { op: "set", target: "cell", path: "nope/value", value: number(1), was: null }
    ]);
    expect(ops).toHaveLength(1);
  });

  it("answers nothing for no ops at all", () => {
    expect(withRecalculation(sourceOf(SHEET, sheetOf({})), [])).toEqual([]);
  });
});
