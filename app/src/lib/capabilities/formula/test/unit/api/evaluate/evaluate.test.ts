import { describe, expect, it } from "vitest";
import { evaluate } from "$formula/api/evaluate/evaluate";
import { asCtx, asking, EMPTY, number, text } from "$formula/test/fixture";
import { define } from "$name-manager/api/define/define";

describe("evaluate", () => {
  it("computes arithmetic, precedence and all", async () => {
    const { ctx, scope } = await asking();

    expect(await evaluate(asCtx(ctx), scope, "=1 + 2 * 3")).toEqual({
      state: "fresh",
      value: number(7)
    });
  });

  it("resolves a name through the name manager", async () => {
    const { ctx, scope } = await asking();
    await define(asCtx(ctx), scope, {
      name: "Target Margin",
      declaredType: "number",
      value: { kind: "number", value: 42 }
    });

    expect(await evaluate(asCtx(ctx), scope, "=TargetMargin * 2")).toEqual({
      state: "fresh",
      value: number(84)
    });
  });

  it("reads the cells it was handed, and a blank one as empty", async () => {
    const { ctx, scope } = await asking();

    // Not zero, not an empty string, and not a failure: a reference to a blank
    // cell is none of those, and collapsing it is how a sum counts a gap as a
    // value.
    const blank = await evaluate(asCtx(ctx), scope, "=B2", { A1: number(1) });

    expect(blank).toEqual({ state: "fresh", value: EMPTY });
    expect(blank).not.toEqual({ state: "fresh", value: number(0) });
    expect(blank).not.toEqual({ state: "fresh", value: text("") });
  });

  it("averages over the values there are, not over the rows", async () => {
    const { ctx, scope } = await asking();

    expect(
      await evaluate(asCtx(ctx), scope, "=AVERAGE(A1:A3)", { A1: number(10), A3: number(20) })
    ).toEqual({ state: "fresh", value: number(15) });
  });

  it("reports a failure as a state, never as a value", async () => {
    const { ctx, scope } = await asking();

    for (const expression of ["=SUM(", "=1/0", "=Nothing", '="EMEA" + 1']) {
      const result = await evaluate(asCtx(ctx), scope, expression);

      // `FormulaValue` has no error kind, so a consumer holding a value never
      // re-checks whether it really is one.
      expect(result.state).toBe("error");
      expect(result).not.toHaveProperty("value");
      expect(result).toHaveProperty("error", expect.any(String));
    }
  });

  it("says what failed, because the message is what a reader acts on", async () => {
    const { ctx, scope } = await asking();

    const result = await evaluate(asCtx(ctx), scope, "=Nothing");

    expect(result).toMatchObject({ state: "error", error: expect.stringContaining("Nothing") });
  });

  it("lets a fault through rather than reporting it as a failed formula", async () => {
    const { ctx, scope } = await asking();
    const broken = { db: { query: () => { throw new TypeError("the database is on fire"); } } };

    // A refusal becomes a result; anything else is a fault and stays one, which
    // is the same line Convex draws at the wire.
    await expect(
      evaluate(broken as never, scope, "=Nothing")
    ).rejects.toThrow(TypeError);

    expect(ctx).toBeDefined();
  });
});
