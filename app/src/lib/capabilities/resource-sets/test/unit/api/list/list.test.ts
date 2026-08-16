import { describe, expect, it } from "vitest";
import { list } from "$resource-sets/api/list/list";
import { aDocument, aSet, asCtx, asking } from "$resource-sets/test/fixture";

describe("list", () => {
  it("returns the project's sets as their expressions", async () => {
    const { ctx, scope, userId } = await asking();
    await aDocument(ctx, scope, "Notes");
    const id = await aSet(ctx, scope, "Everything", { op: "project" });

    // A list read stays one range however much the project holds: what each set
    // selects is `resolve`'s question, asked when something needs the answer.
    expect(await list(asCtx(ctx), scope)).toEqual([
      {
        id,
        name: "Everything",
        description: undefined,
        expression: { op: "project" },
        createdBy: { kind: "user", userId },
        revision: 1,
        updatedAt: 1_700_000_000_000
      }
    ]);
  });

  it("returns no set from another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    await aSet(ctx, elsewhere, "Theirs", { op: "project" });

    expect(await list(asCtx(ctx), scope)).toEqual([]);
  });
});
