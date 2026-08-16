import { describe, expect, it } from "vitest";
import { define } from "$name-manager/api/define/define";
import { list } from "$name-manager/api/list/list";
import { asCtx, asking, projectNamed, scopeOf } from "$name-manager/test/fixture";

const number = (name: string, value: number) =>
  ({ name, declaredType: "number", value: { kind: "number", value } }) as const;

describe("list", () => {
  it("returns a project's variables in the order they were defined", async () => {
    const { ctx, scope } = await asking();
    await define(asCtx(ctx), scope, number("Second", 2));
    await define(asCtx(ctx), scope, number("First", 1));

    expect((await list(asCtx(ctx), scope)).map((variable) => variable.name)).toEqual([
      "Second",
      "First"
    ]);
  });

  it("returns no other project's variables", async () => {
    const { ctx, scope, userId } = await asking();
    const elsewhere = scopeOf(await projectNamed(ctx, "Another"), userId);
    await define(asCtx(ctx), scope, number("Mine", 1));
    await define(asCtx(ctx), elsewhere, number("Theirs", 2));

    expect((await list(asCtx(ctx), scope)).map((variable) => variable.name)).toEqual(["Mine"]);
  });

  it("carries both forms of the name, so a caller can display one and look up by the other", async () => {
    const { ctx, scope } = await asking();
    await define(asCtx(ctx), scope, number("Target Margin", 42));

    expect(await list(asCtx(ctx), scope)).toMatchObject([
      { name: "Target Margin", nameKey: "targetmargin", declaredType: "number" }
    ]);
  });
});
