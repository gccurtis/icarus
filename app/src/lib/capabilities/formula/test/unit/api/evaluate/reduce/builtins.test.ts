import { describe, expect, it } from "vitest";
import type { FormulaValue } from "$content/types/value";
import { BUILTINS, isBuiltin } from "$formula/api/evaluate/reduce/builtins";
import { EMPTY, number, refusalOf, text } from "$formula/test/fixture";

const column = (...cells: FormulaValue[]): FormulaValue => ({
  kind: "table",
  columns: [{ name: "A" }],
  rows: cells.map((cell) => [cell])
});

describe("the builtins", () => {
  it("names the five pass 2 has, and none of the relational ones", () => {
    expect(Object.keys(BUILTINS).sort()).toEqual(["AVERAGE", "COUNT", "MAX", "MIN", "SUM"]);
    // JOIN, WHERE, GROUP, AGGREGATE, and SORT are what an analysis compiles to,
    // and they arrive with analyses in pass 8.
    expect(isBuiltin("JOIN")).toBe(false);
  });

  it("recognizes a builtin whatever case it is written in", () => {
    expect(isBuiltin("sum")).toBe(true);
  });

  it("reads a range as its cells", () => {
    expect(BUILTINS.SUM([column(number(1), number(2), number(3))])).toEqual(number(6));
    expect(BUILTINS.SUM([number(1), column(number(2))])).toEqual(number(3));
  });

  it("skips a gap rather than counting it as a value", () => {
    // The whole reason `empty` is its own kind: an average over a column with a
    // blank in it divides by the values there are.
    expect(BUILTINS.AVERAGE([column(number(10), EMPTY, number(20))])).toEqual(number(15));
    expect(BUILTINS.COUNT([column(number(10), EMPTY, number(20))])).toEqual(number(2));
    expect(BUILTINS.SUM([column(number(10), EMPTY, number(20))])).toEqual(number(30));
  });

  it("counts anything present, not only numbers", () => {
    expect(BUILTINS.COUNT([column(text("EMEA"), EMPTY)])).toEqual(number(1));
  });

  it("finds the ends of a range", () => {
    expect(BUILTINS.MIN([column(number(3), number(1), number(2))])).toEqual(number(1));
    expect(BUILTINS.MAX([column(number(3), number(1), number(2))])).toEqual(number(3));
  });

  it("answers empty when there was nothing to aggregate", () => {
    // The sum of nothing is not zero, and neither is the smallest of nothing.
    // `COUNT` is the exception because counting is defined on nothing.
    expect(BUILTINS.SUM([column(EMPTY, EMPTY)])).toEqual(EMPTY);
    expect(BUILTINS.AVERAGE([column(EMPTY)])).toEqual(EMPTY);
    expect(BUILTINS.MIN([])).toEqual(EMPTY);
    expect(BUILTINS.COUNT([])).toEqual(number(0));
  });

  it("refuses text where it needed a number, rather than passing over it", () => {
    expect(refusalOf(() => BUILTINS.SUM([column(number(1), text("EMEA"))]))).toMatchObject({
      code: "type-mismatch"
    });
  });
});
