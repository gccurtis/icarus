import { describe, expect, it } from "vitest";
import { parse } from "$formula/api/evaluate/parse";
import { refusalOf } from "$formula/test/fixture";

describe("parse", () => {
  it("drops the leading '=' an author types", () => {
    expect(parse("=1")).toEqual(parse("1"));
  });

  it("binds multiplication tighter than addition", () => {
    expect(parse("1 + 2 * 3")).toEqual({
      kind: "binary",
      operator: "+",
      left: { kind: "number", value: 1 },
      right: {
        kind: "binary",
        operator: "*",
        left: { kind: "number", value: 2 },
        right: { kind: "number", value: 3 }
      }
    });
  });

  it("lets parentheses say otherwise", () => {
    expect(parse("(1 + 2) * 3")).toMatchObject({
      kind: "binary",
      operator: "*",
      left: { kind: "binary", operator: "+" }
    });
  });

  it("associates addition to the left, so 1-2-3 is (1-2)-3", () => {
    expect(parse("1 - 2 - 3")).toMatchObject({
      kind: "binary",
      operator: "-",
      left: { kind: "binary", operator: "-", left: { value: 1 }, right: { value: 2 } },
      right: { value: 3 }
    });
  });

  it("associates exponentiation to the right, so 2^3^2 is 2^(3^2)", () => {
    expect(parse("2 ^ 3 ^ 2")).toMatchObject({
      kind: "binary",
      operator: "^",
      left: { value: 2 },
      right: { kind: "binary", operator: "^", left: { value: 3 }, right: { value: 2 } }
    });
  });

  it("reads a negation as a negation rather than a subtraction of nothing", () => {
    expect(parse("-A1")).toEqual({
      kind: "unary",
      operator: "-",
      operand: { kind: "cell", reference: "A1" }
    });
  });

  it("tells a cell reference from a name by its shape", () => {
    expect(parse("B7")).toEqual({ kind: "cell", reference: "B7" });
    expect(parse("TargetMargin")).toEqual({ kind: "name", name: "TargetMargin" });
  });

  it("normalizes a reference's casing, because B7 and b7 are one cell", () => {
    expect(parse("b7")).toEqual({ kind: "cell", reference: "B7" });
    expect(parse("a1:b3")).toEqual({ kind: "range", from: "A1", to: "B3" });
  });

  it("reads a call and its arguments", () => {
    expect(parse("SUM(A1:A3, 2)")).toEqual({
      kind: "call",
      name: "SUM",
      arguments: [
        { kind: "range", from: "A1", to: "A3" },
        { kind: "number", value: 2 }
      ]
    });
  });

  it("reads text and the two logic literals", () => {
    expect(parse('"EMEA"')).toEqual({ kind: "text", value: "EMEA" });
    expect(parse("TRUE")).toEqual({ kind: "boolean", value: true });
    expect(parse("false")).toEqual({ kind: "boolean", value: false });
  });

  it("refuses an expression it cannot read, rather than guessing at one", () => {
    for (const expression of ["=SUM(", "1 +", "(1", '"unterminated', "1 2", "£"]) {
      expect(refusalOf(() => parse(expression))).toMatchObject({ code: "syntax" });
    }
  });

  it("refuses an empty expression", () => {
    expect(refusalOf(() => parse("=" ))).toMatchObject({ code: "syntax" });
  });
});
