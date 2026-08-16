import { describe, expect, it } from "vitest";
import { define } from "$name-manager/api/define/define";
import { findVariable } from "$name-manager/api/shared/find-variable";
import { asCtx, asking, projectNamed, scopeOf } from "$name-manager/test/fixture";

const MARGIN = { name: "Target Margin", declaredType: "number", value: { kind: "number", value: 42 } } as const;

describe("findVariable", () => {
  it("finds a variable by any spelling of its name", async () => {
    const { ctx, scope } = await asking();
    await define(asCtx(ctx), scope, MARGIN);

    for (const spelling of ["Target Margin", "targetmargin", "TARGET  MARGIN"]) {
      expect(await findVariable(asCtx(ctx), scope, spelling)).toMatchObject({
        name: "Target Margin",
        value: { kind: "number", value: 42 }
      });
    }
  });

  it("answers with the authored casing, never the lookup form", async () => {
    const { ctx, scope } = await asking();
    await define(asCtx(ctx), scope, MARGIN);

    expect(await findVariable(asCtx(ctx), scope, "targetmargin")).toMatchObject({
      name: "Target Margin",
      nameKey: "targetmargin"
    });
  });

  it("does not see another project's variable", async () => {
    const { ctx, scope, userId } = await asking();
    const elsewhere = scopeOf(await projectNamed(ctx, "Another"), userId);
    await define(asCtx(ctx), elsewhere, MARGIN);

    expect(await findVariable(asCtx(ctx), scope, "Target Margin")).toBeUndefined();
  });

  it("is undefined for a name nobody defined", async () => {
    const { ctx, scope } = await asking();

    expect(await findVariable(asCtx(ctx), scope, "Nothing")).toBeUndefined();
  });
});
