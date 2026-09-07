import { describe, expect, it } from "vitest";

import { gridOf } from "$representation/data/behavior/spreadsheets/addressing";
import { shifted, toShown, toStored, type SheetFacts } from "$representation/data/behavior/spreadsheets/translation";
import type { Id } from "$representation/data/types/core/id";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";

const body = (rows: number, columns: number): SpreadsheetBody =>
  ({
    rows: Array.from({ length: rows }, (_, index) => ({ id: `r${index + 1}`, order: index + 1 })),
    columns: Array.from({ length: columns }, (_, index) => ({ id: `c${index + 1}`, order: index + 1 })),
    rowPartCounts: [],
    formatRules: [],
    print: { page: {} },
    styles: {}
  }) as unknown as SpreadsheetBody;

const HERE: SheetFacts = {
  resourceId: "spreadsheets:1" as Id<"spreadsheets">,
  title: "Outage minutes",
  grid: gridOf(body(20, 10))
};

const THERE: SheetFacts = {
  resourceId: "spreadsheets:2" as Id<"spreadsheets">,
  title: "Hardening cost model",
  grid: gridOf(body(20, 10))
};

const byTitle = (title: string): SheetFacts | undefined =>
  title === THERE.title ? THERE : title === HERE.title ? HERE : undefined;

const byId = (id: string): SheetFacts | undefined =>
  id === THERE.resourceId ? THERE : id === HERE.resourceId ? HERE : undefined;

describe("what a person typed, on the way in", () => {
  it("turns a cell and a range into ids", () => {
    expect(toStored("=E4", HERE).formula).toBe("=`cell|spreadsheets:1|r4|c5`");
    expect(toStored("=SUM(B4:B17)", HERE).formula).toBe("=SUM(`range|spreadsheets:1|r4|c2|r17|c2`)");
  });

  it("leaves the lock beside the formula rather than inside it", () => {
    expect(toStored("=$E$4", HERE).formula).toBe(toStored("=E4", HERE).formula);
    expect(toStored("=E$4", HERE).formula).toBe(toStored("=E4", HERE).formula);
    expect(toStored("=$E4", HERE).formula).toBe(toStored("=E4", HERE).formula);

    expect(toStored("=E4", HERE).anchors).toEqual([""]);
    expect(toStored("=$E$4", HERE).anchors).toEqual(["cr"]);
    expect(toStored("=E$4", HERE).anchors).toEqual(["r"]);
    expect(toStored("=$E4", HERE).anchors).toEqual(["c"]);
    expect(toStored("=SUM($B$4:B17)", HERE).anchors).toEqual(["cr:"]);
  });

  it("keeps everything that is not a reference exactly as it was", () => {
    expect(toStored('=IF(E4 > 10, "over", "under")', HERE).formula).toBe(
      '=IF(`cell|spreadsheets:1|r4|c5` > 10, "over", "under")'
    );
    expect(toStored("=rates_perMinute * 2", HERE).formula).toBe("=rates_perMinute * 2");
    expect(toStored('="E4 is a label"', HERE).formula).toBe('="E4 is a label"');
  });

  it("does not mistake a function name for an address", () => {
    expect(toStored("=SUM(1)", HERE).formula).toBe("=SUM(1)");
    expect(toStored("=A1B", HERE).formula).toBe("=A1B");
  });

  it("names another sheet by the id it turns out to have", () => {
    expect(toStored("='Hardening cost model'!E10", HERE, byTitle).formula).toBe("=`cell|spreadsheets:2|r10|c5`");
  });

  it("writes an address nothing is at, so the answer is a refusal rather than a guess", () => {
    expect(toStored("=Z99", HERE).formula).toBe("=`cell|spreadsheets:1|?|?`");
  });
});

describe("what is stored, on the way out", () => {
  it("draws a cell and a range the way the sheet reads", () => {
    expect(toShown("=`cell|spreadsheets:1|r4|c5`", HERE)).toBe("=E4");
    expect(toShown("=SUM(`range|spreadsheets:1|r4|c2|r17|c2`)", HERE)).toBe("=SUM(B4:B17)");
  });

  it("qualifies another sheet by its title, quoting it when it has to", () => {
    expect(toShown("=`cell|spreadsheets:2|r10|c5`", HERE, { byId })).toBe("='Hardening cost model'!E10");
  });

  it("draws the locks the sheet remembered beside it", () => {
    const stored = toStored("=$E$4 + B4:B17", HERE);
    expect(toShown(stored.formula, HERE, { anchors: stored.anchors })).toBe("=$E$4 + B4:B17");
    expect(toShown(toStored("=E$4", HERE).formula, HERE, { anchors: ["r"] })).toBe("=E$4");
    expect(toShown(toStored("=$E4", HERE).formula, HERE, { anchors: ["c"] })).toBe("=$E4");
  });

  it("says so when what is stored no longer names anything", () => {
    expect(toShown("=`cell|spreadsheets:1|?|?`", HERE)).toBe("=#REF!");
    expect(toShown("=`cell|spreadsheets:9|r1|c1`", HERE)).toBe("=#REF!");
    expect(toShown("=`nonsense`", HERE)).toBe("=#REF!");
  });

  it("leaves anything that is not an address alone", () => {
    expect(toShown('=IF(rate > 10, "over", "under")', HERE)).toBe('=IF(rate > 10, "over", "under")');
  });
});

describe("moving a formula", () => {
  const drawn = (formula: string, anchors: readonly string[]): string =>
    toShown(formula, HERE, { anchors });

  it("shifts every reference by the same offset", () => {
    const stored = toStored("=E4*60/C4", HERE);
    const moved = shifted(stored.formula, stored.anchors, HERE.grid, 1, 0);
    expect(drawn(moved, stored.anchors)).toBe("=E5*60/C5");
  });

  it("holds still the half a lock holds still", () => {
    const stored = toStored("=$E$4 + E4 + E$4 + $E4", HERE);
    const moved = shifted(stored.formula, stored.anchors, HERE.grid, 1, 1);
    expect(drawn(moved, stored.anchors)).toBe("=$E$4 + F5 + F$4 + $E5");
  });

  it("moves both ends of a range", () => {
    const stored = toStored("=SUM(B4:B6)", HERE);
    const moved = shifted(stored.formula, stored.anchors, HERE.grid, 2, 0);
    expect(drawn(moved, stored.anchors)).toBe("=SUM(B6:B8)");
  });

  it("writes an address nothing is at when a reference would leave the grid", () => {
    const stored = toStored("=A1", HERE);
    const moved = shifted(stored.formula, stored.anchors, HERE.grid, -1, 0);
    expect(drawn(moved, stored.anchors)).toBe("=#REF!");
  });

  it("leaves a formula with no references alone", () => {
    const stored = toStored("=rate * 2", HERE);
    expect(shifted(stored.formula, stored.anchors, HERE.grid, 3, 3)).toBe(stored.formula);
  });
});

describe("the two together", () => {
  it("round trips every reference a person can write", () => {
    for (const typed of ["=E4", "=SUM(B4:B17)", "=E4*60/C4", "=A1+B2-C3", "=MEAN(A1:C3)", "=$A$1+B$2"]) {
      const stored = toStored(typed, HERE);
      expect(toShown(stored.formula, HERE, { anchors: stored.anchors })).toBe(typed);
    }
  });

  it("round trips a reference to another sheet", () => {
    const typed = "='Hardening cost model'!E10";
    const stored = toStored(typed, HERE, byTitle);
    expect(toShown(stored.formula, HERE, { byId, anchors: stored.anchors })).toBe(typed);
  });

  it("draws the same stored formula differently after a row is inserted above", () => {
    const stored = toStored("=E4", HERE);
    const shifted: SheetFacts = {
      ...HERE,
      grid: gridOf({
        ...body(20, 10),
        rows: [{ id: "new", order: 0 }, ...body(20, 10).rows]
      } as SpreadsheetBody)
    };
    expect(toShown(stored.formula, HERE)).toBe("=E4");
    expect(toShown(stored.formula, shifted)).toBe("=E5");
  });
});
