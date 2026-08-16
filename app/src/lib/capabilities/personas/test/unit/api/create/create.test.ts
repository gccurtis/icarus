import { describe, expect, it } from "vitest";
import { create } from "$personas/api/create/create";
import { asCtx, asking, blankDefinition, draft, refusalFrom } from "$personas/test/fixture";

describe("create", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, userId } = await asking();

    const id = await create(asCtx(ctx), scope, draft("  Researcher  "));

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      name: "Researcher",
      revision: 1,
      createdBy: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "created",
      target: { type: "persona", id, label: "Researcher" }
    });
  });

  it("cannot make a global one, because publishing from inside a project is not a right", async () => {
    // A global persona is in everyone's list; a member of any project putting a
    // row there is not something a project-scoped surface can be allowed to do.
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, draft());

    expect(ctx.rows.get(id)?.projectId).toBe(scope.projectId);
  });

  it("takes a pure scope persona, which says nothing and works against material", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, {
      name: "The Q3 material",
      definition: blankDefinition(),
      scope: { op: "kind", kind: "document" },
      tools: []
    });

    expect(ctx.rows.get(id)).toMatchObject({
      definition: blankDefinition(),
      scope: { op: "kind", kind: "document" }
    });
  });

  it("refuses a persona with nothing to say and nothing to work against", async () => {
    const { ctx, scope } = await asking();

    expect(
      await refusalFrom(
        create(asCtx(ctx), scope, {
          name: "Nobody",
          definition: blankDefinition(),
          tools: []
        })
      )
    ).toMatchObject({ code: "empty-definition" });
    expect(ctx.log).toHaveLength(0);
  });

  it("refuses a persona nobody can address", async () => {
    const { ctx, scope } = await asking();

    expect(await refusalFrom(create(asCtx(ctx), scope, draft("   ")))).toMatchObject({
      code: "empty-name"
    });
  });

  it("stores the tool names, without the repeats that name no second grant", async () => {
    const { ctx, scope } = await asking();

    const id = await create(asCtx(ctx), scope, {
      ...draft(),
      tools: ["search", "search", " read "],
      modelBinding: "fast"
    });

    expect(ctx.rows.get(id)).toMatchObject({ tools: ["search", "read"], modelBinding: "fast" });
  });
});
