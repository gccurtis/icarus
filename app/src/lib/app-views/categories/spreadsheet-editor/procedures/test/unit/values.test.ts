import { describe, expect, it } from "vitest";

import {
  displayOf,
  errorOf,
  formatNumber,
  parseTyped,
  rawOf
} from "$app-views/categories/spreadsheet-editor/procedures/values";

describe("number formats", () => {
  it("group, round and decorate the way the pattern says", () => {
    expect(formatNumber(1842000, "#,##0")).toBe("1,842,000");
    expect(formatNumber(4.1, "$#,##0.00")).toBe("$4.10");
    expect(formatNumber(-1234.5, "$#,##0")).toBe("-$1,235");
    expect(formatNumber(0.125, "0.0%")).toBe("12.5%");
    expect(formatNumber(38.46, "0.0")).toBe("38.5");
    expect(formatNumber(38.46)).toBe("38.46");
  });
});

describe("what a cell shows", () => {
  it("renders every kind of value as text", () => {
    expect(displayOf(undefined)).toBe("");
    expect(displayOf({ kind: "empty" })).toBe("");
    expect(displayOf({ kind: "logic", value: true })).toBe("TRUE");
    expect(displayOf({ kind: "date", value: { calendar: "gregorian", year: 2026, month: 8, day: 30, utc: 0 } })).toBe("2026-08-30");
    expect(displayOf({ kind: "list", values: [{ kind: "number", value: 1 }, { kind: "text", value: "a" }] })).toBe("1, a");
  });

  it("knows an error when the stored text is one", () => {
    expect(errorOf({ kind: "text", value: "#REF!" })).toBe("#REF!");
    expect(errorOf({ kind: "text", value: "#nope" })).toBeUndefined();
    expect(errorOf({ kind: "number", value: 1 })).toBeUndefined();
  });

  it("edits from the expression when there is one and the literal otherwise", () => {
    expect(rawOf({ rowId: "r1", columnId: "c1", value: { kind: "number", value: 12 }, expression: "=A1*2" })).toBe("=A1*2");
    expect(rawOf({ rowId: "r1", columnId: "c1", value: { kind: "number", value: 1842000 } })).toBe("1842000");
    expect(rawOf(undefined)).toBe("");
  });
});

describe("what typing means", () => {
  it("reads numbers, logic, formulas and text apart", () => {
    expect(parseTyped("  ")).toEqual({ kind: "clear" });
    expect(parseTyped("=SUM(A1:A3)")).toEqual({ kind: "expression", expression: "=SUM(A1:A3)" });
    expect(parseTyped("=")).toEqual({ kind: "value", value: { kind: "text", value: "=" } });
    expect(parseTyped("1,842,000")).toEqual({ kind: "value", value: { kind: "number", value: 1842000 } });
    expect(parseTyped("$4.10")).toEqual({ kind: "value", value: { kind: "number", value: 4.1 } });
    expect(parseTyped("12.5%")).toEqual({ kind: "value", value: { kind: "number", value: 0.125 } });
    expect(parseTyped("true")).toEqual({ kind: "value", value: { kind: "logic", value: true } });
    expect(parseTyped("Ashgrove")).toEqual({ kind: "value", value: { kind: "text", value: "Ashgrove" } });
  });
});
