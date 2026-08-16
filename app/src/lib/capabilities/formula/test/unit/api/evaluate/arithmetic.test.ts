import { describe, expect, it } from "vitest";
import { apply, negate } from "$formula/api/evaluate/arithmetic";
import { EMPTY, number, refusalOf, text } from "$formula/test/fixture";

describe("arithmetic", () => {
  it("computes over numbers", () => {
    expect(apply("+", number(2), number(3))).toEqual(number(5));
    expect(apply("-", number(2), number(3))).toEqual(number(-1));
    expect(apply("*", number(2), number(3))).toEqual(number(6));
    expect(apply("/", number(6), number(3))).toEqual(number(2));
    expect(apply("^", number(2), number(3))).toEqual(number(8));
    expect(negate(number(2))).toEqual(number(-2));
  });

  it("refuses to divide by zero rather than answering Infinity", () => {
    expect(refusalOf(() => apply("/", number(1), number(0)))).toMatchObject({
      code: "division-by-zero"
    });
  });

  it("refuses an empty operand, because a blank is not a zero", () => {
    // Coercing it would make `=A1*2` answer 0 for a cell nobody has filled in,
    // which reads exactly like an answer.
    expect(refusalOf(() => apply("*", EMPTY, number(2)))).toMatchObject({
      code: "empty-operand"
    });
    expect(refusalOf(() => apply("+", number(2), EMPTY))).toMatchObject({
      code: "empty-operand"
    });
    expect(refusalOf(() => negate(EMPTY))).toMatchObject({ code: "empty-operand" });
  });

  it("refuses an operand that is not a number", () => {
    expect(refusalOf(() => apply("+", text("EMEA"), number(1)))).toMatchObject({
      code: "type-mismatch"
    });
    expect(
      refusalOf(() => apply("+", { kind: "table", columns: [], rows: [] }, number(1)))
    ).toMatchObject({ code: "type-mismatch" });
  });
});
