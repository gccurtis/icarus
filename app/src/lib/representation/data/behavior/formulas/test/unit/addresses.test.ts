import { describe, expect, it } from "vitest";

import { addressText, addressesIn, readAddress, sameAddress, writeAddress } from "$representation/data/behavior/formulas/addresses";
import { asId } from "$representation/data/behavior/core/id";
import type { Id } from "$representation/data/types/core/id";
import type { Address } from "$representation/data/types/formulas/expression";

const sheet = "spreadsheets:1" as Id<"spreadsheets">;

const CELL: Address = { at: "cell", resourceId: sheet, cell: { rowId: "r4", columnId: "c5" } };
const RANGE: Address = {
  at: "range",
  resourceId: sheet,
  range: { from: { rowId: "r4", columnId: "c5" }, to: { rowId: "r17", columnId: "c5" } }
};
const RESOURCE: Address = {
  at: "resource",
  ref: { kind: "spreadsheet", id: asId<"spreadsheets">("spreadsheets:2") }
};

describe("how an id is written inside a formula", () => {
  it("writes each kind so it can be read back unchanged", () => {
    for (const address of [CELL, RANGE, RESOURCE]) {
      expect(readAddress(writeAddress(address))).toEqual(address);
    }
  });

  it("spells them the way a stored formula shows them", () => {
    expect(writeAddress(CELL)).toBe("cell|spreadsheets:1|r4|c5");
    expect(writeAddress(RANGE)).toBe("range|spreadsheets:1|r4|c5|r17|c5");
    expect(writeAddress(RESOURCE)).toBe("resource|spreadsheet|spreadsheets:2");
    expect(addressText(CELL)).toBe("`cell|spreadsheets:1|r4|c5`");
  });

  it("refuses anything that is not one of the three shapes", () => {
    expect(readAddress("cell|spreadsheets:1|r4")).toBeUndefined();
    expect(readAddress("cell|spreadsheets:1|r4|c5|extra")).toBeUndefined();
    expect(readAddress("what|a|b|c")).toBeUndefined();
    expect(readAddress("")).toBeUndefined();
    expect(readAddress("cell|spreadsheets:1||c5")).toBeUndefined();
  });

  it("compares two addresses by what they name", () => {
    expect(sameAddress(CELL, { ...CELL, cell: { rowId: "r4", columnId: "c5" } })).toBe(true);
    expect(sameAddress(CELL, RANGE)).toBe(false);
  });

  it("lifts every address out of a formula by scanning, even a broken one", () => {
    const formula = "=`cell|spreadsheets:1|r4|c5` * 60 / `cell|spreadsheets:1|r4|c3` + oops(";
    expect(addressesIn(formula)).toEqual([
      CELL,
      { at: "cell", resourceId: sheet, cell: { rowId: "r4", columnId: "c3" } }
    ]);
  });

  it("skips a mark that never closes", () => {
    expect(addressesIn("=`cell|spreadsheets:1|r4|c5` + `unclosed")).toEqual([CELL]);
    expect(addressesIn("no addresses here")).toEqual([]);
  });
});
