import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { revise } from "$resource-sets/api/revise/revise";
import { aSet, asCtx, asking, refusalFrom } from "$resource-sets/test/fixture";

const narrowed = {
  name: "Findings only",
  expression: { op: "kind", kind: "finding" }
} as const;

describe("revise", () => {
  it("replaces the expression and moves the revision on", async () => {
    const { ctx, scope } = await asking();
    const id = (await aSet(ctx, scope, "Everything", { op: "project" })) as Id<"resourceSets">;

    await revise(asCtx(ctx), scope, id, 1, narrowed);

    // Everything using the set sees the new expression at once — the reference
    // is not a copy, so an edit here is visible everywhere.
    expect(ctx.rows.get(id)).toMatchObject({
      name: "Findings only",
      expression: { op: "kind", kind: "finding" },
      revision: 2
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "revised",
      target: { type: "resourceSet", id, label: "Findings only" }
    });
  });

  it("refuses an edit against a revision that has moved", async () => {
    const { ctx, scope } = await asking();
    const id = (await aSet(ctx, scope, "Everything", { op: "project" })) as Id<"resourceSets">;
    await revise(asCtx(ctx), scope, id, 1, narrowed);

    // A transaction covers a read and a write in one mutation; it does not cover
    // a form somebody left open while someone else narrowed the same scope.
    expect(
      await refusalFrom(revise(asCtx(ctx), scope, id, 1, { ...narrowed, name: "Mine" }))
    ).toMatchObject({ code: "stale" });
    expect(ctx.rows.get(id)).toMatchObject({ name: "Findings only", revision: 2 });
  });

  it("reports not found for a set in another project", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const theirs = (await aSet(ctx, elsewhere, "Theirs", { op: "project" })) as Id<"resourceSets">;

    expect(await refusalFrom(revise(asCtx(ctx), scope, theirs, 1, narrowed))).toMatchObject({
      code: "not-found"
    });
    expect(ctx.rows.get(theirs)).toMatchObject({ name: "Theirs" });
  });

  it("refuses a name nothing can pick out, leaving the set alone", async () => {
    const { ctx, scope } = await asking();
    const id = (await aSet(ctx, scope, "Everything", { op: "project" })) as Id<"resourceSets">;

    expect(
      await refusalFrom(revise(asCtx(ctx), scope, id, 1, { ...narrowed, name: " " }))
    ).toMatchObject({ code: "empty-name" });
    expect(ctx.rows.get(id)).toMatchObject({ name: "Everything", revision: 1 });
  });
});
