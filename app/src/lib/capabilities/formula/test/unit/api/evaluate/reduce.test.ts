import { describe, expect, it } from "vitest";
import { parse } from "$formula/api/evaluate/parse";
import { reduce } from "$formula/api/evaluate/reduce";
import { asCtx, asking, EMPTY, number, refusalFrom, text } from "$formula/test/fixture";
import { define } from "$name-manager/api/define/define";
import type { VariableDefinition } from "$name-manager/types/variable";

const CELLS = { A1: number(10), A2: number(20), B1: text("EMEA") };

const of = async (expression: string, cells = CELLS) => {
  const { ctx, scope } = await asking();
  return await reduce(asCtx(ctx), scope, parse(expression), cells);
};

const withVariable = async (definition: VariableDefinition) => {
  const { ctx, scope } = await asking();
  await define(asCtx(ctx), scope, definition);
  return { ctx, scope };
};

describe("reduce", () => {
  it("reads a cell that holds something", async () => {
    expect(await of("A1")).toEqual(number(10));
  });

  it("reads a blank cell as empty — not zero, not text, not a failure", async () => {
    expect(await of("Z9")).toEqual(EMPTY);
    expect(await of("Z9")).not.toEqual(number(0));
    expect(await of("Z9")).not.toEqual(text(""));
  });

  it("reads a range as a table, one column per letter and one row per number", async () => {
    expect(await of("A1:B2")).toEqual({
      kind: "table",
      columns: [{ name: "A" }, { name: "B" }],
      rows: [
        [number(10), text("EMEA")],
        [number(20), EMPTY]
      ]
    });
  });

  it("reads a range written backwards as the same range", async () => {
    expect(await of("A2:A1")).toEqual(await of("A1:A2"));
  });

  it("resolves a bare name through the name manager, in any spelling", async () => {
    const { ctx, scope } = await withVariable({
      name: "Target Margin",
      declaredType: "number",
      value: { kind: "number", value: 42 }
    });

    // The name manager's key drops whitespace, which is what lets an expression
    // — where a bare name cannot contain a space — reach `Target Margin`.
    expect(await reduce(asCtx(ctx), scope, parse("TargetMargin"), {})).toEqual(number(42));
    expect(await reduce(asCtx(ctx), scope, parse("targetmargin"), {})).toEqual(number(42));
  });

  it("refuses a name nothing defines", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(reduce(asCtx(ctx), scope, parse("Nothing"), {}))
    ).toMatchObject({ code: "unknown-name" });
  });

  it("stands a list up as a table, so a name can be aggregated whatever it was declared", async () => {
    const { ctx, scope } = await withVariable({
      name: "Quarters",
      declaredType: "list",
      value: { kind: "list", values: [number(1), number(2)] }
    });

    expect(await reduce(asCtx(ctx), scope, parse("SUM(Quarters)"), {})).toEqual(number(3));
  });

  it("refuses a name that holds a function, which is not a value", async () => {
    const { ctx, scope } = await withVariable({
      name: "Double",
      declaredType: "function",
      value: { kind: "function", parameters: ["x"], expression: "x*2" }
    });

    expect(
      await refusalFrom(reduce(asCtx(ctx), scope, parse("Double"), {}))
    ).toMatchObject({ code: "type-mismatch" });
  });

  it("calls a builtin over what it was given", async () => {
    expect(await of("SUM(A1:A2, 5)")).toEqual(number(35));
  });

  it("refuses a call to something that is not a builtin", async () => {
    const { ctx, scope } = await asking();

    // JOIN and its four siblings are pass 8's, and a formula that half-works is
    // worse than one that says it does not.
    expect(
      await refusalFrom(reduce(asCtx(ctx), scope, parse("JOIN(A1:A2)"), CELLS))
    ).toMatchObject({ code: "unknown-function" });
  });

  it("computes through the operators", async () => {
    expect(await of("A1 + A2 * 2")).toEqual(number(50));
    expect(await of("-A1")).toEqual(number(-10));
  });

  it("reads the literals a formula can hold", async () => {
    expect(await of('"EMEA"')).toEqual(text("EMEA"));
    expect(await of("TRUE")).toEqual({ kind: "boolean", value: true });
  });
});
