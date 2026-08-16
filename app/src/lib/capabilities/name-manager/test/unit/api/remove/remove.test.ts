import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { define } from "$name-manager/api/define/define";
import { remove } from "$name-manager/api/remove/remove";
import { asCtx, asking, projectNamed, refusalFrom, scopeOf, variablesStored } from "$name-manager/test/fixture";

const MARGIN = { name: "Target Margin", declaredType: "number", value: { kind: "number", value: 42 } } as const;

describe("remove", () => {
  it("frees the name it deletes", async () => {
    const { ctx, scope } = await asking();
    const id = await remove_(ctx, scope);

    expect(variablesStored(ctx)).toHaveLength(0);
    // The whole point of removing one: the name can be defined again.
    await define(asCtx(ctx), scope, MARGIN);
    expect(variablesStored(ctx)).toHaveLength(1);
    expect(id).toBeDefined();
  });

  it("reads the name before deleting, so the log still says what went", async () => {
    const { ctx, scope } = await asking();
    await remove_(ctx, scope);

    expect(ctx.log.at(-1)).toMatchObject({
      verb: "removed",
      target: { type: "variable", label: "Target Margin" }
    });
  });

  it("reports not found for a variable in another project", async () => {
    const { ctx, scope, userId } = await asking();
    const elsewhere = scopeOf(await projectNamed(ctx, "Another"), userId);
    const id = await define(asCtx(ctx), elsewhere, MARGIN);

    // Not "forbidden": telling them apart confirms the variable exists to
    // someone with no right to know that.
    expect(await refusalFrom(remove(asCtx(ctx), scope, id))).toMatchObject({ code: "not-found" });
    expect(variablesStored(ctx)).toHaveLength(1);
  });

  it("reports not found for an id nobody defined", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(remove(asCtx(ctx), scope, "nameVariables:9" as Id<"nameVariables">))
    ).toMatchObject({ code: "not-found" });
  });
});

const remove_ = async (
  ctx: Awaited<ReturnType<typeof asking>>["ctx"],
  scope: Awaited<ReturnType<typeof asking>>["scope"]
) => {
  const id = await define(asCtx(ctx), scope, MARGIN);
  await remove(asCtx(ctx), scope, id);
  return id;
};
