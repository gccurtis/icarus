import { describe, expect, it } from "vitest";
import { create } from "$resource-sets/api/create/create";
import { asCtx, asking, refusalFrom } from "$resource-sets/test/fixture";

describe("create", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await create(asCtx(ctx), scope, {
      name: "  Everything except drafts  ",
      description: "What a report may draw on",
      expression: {
        op: "difference",
        from: { op: "project" },
        remove: { op: "kind", kind: "document" }
      }
    });

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      name: "Everything except drafts",
      revision: 1,
      createdBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "created",
      target: { type: "resourceSet", id, label: "Everything except drafts" }
    });
  });

  it("stores the expression and nothing it selects", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, {
      name: "Everything",
      expression: { op: "project" }
    });

    // Storing what it currently selects would fix the set to the project as it
    // was, which is the one thing the model exists to prevent.
    expect(ctx.rows.get(id)?.expression).toEqual({ op: "project" });
    expect(ctx.rows.get(id)).not.toHaveProperty("refs");
  });

  it("refuses a set nothing can pick out, writing nothing", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(create(asCtx(ctx), scope, { name: "  ", expression: { op: "project" } }))
    ).toMatchObject({ code: "empty-name" });
    expect(ctx.log).toHaveLength(0);
  });
});
