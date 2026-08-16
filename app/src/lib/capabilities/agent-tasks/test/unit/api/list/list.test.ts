import { describe, expect, it } from "vitest";
import { list } from "$agent-tasks/api/list/list";
import { asCtx, dispatching, taskIn } from "$agent-tasks/test/fixture";

describe("list", () => {
  it("returns the caller's project and nothing else", async () => {
    const { ctx, scope, elsewhere } = await dispatching();
    const mine = await taskIn(ctx, scope.projectId, { title: "Mine" });
    await taskIn(ctx, elsewhere.projectId, { title: "Theirs" });

    expect(await list(asCtx(ctx), scope)).toMatchObject([{ id: mine, title: "Mine" }]);
  });

  it("answers 'what is running' without reading every task's deliverable", async () => {
    const { ctx, scope } = await dispatching();
    await taskIn(ctx, scope.projectId, { status: "draft" });
    const running = await taskIn(ctx, scope.projectId, { status: "running" });

    const found = await list(asCtx(ctx), scope, { status: "running" });

    expect(found.map((task) => task.id)).toEqual([running]);
    expect(found[0]).not.toHaveProperty("result");
    expect(found[0]).not.toHaveProperty("prompt");
  });

  it("answers 'what has this persona done'", async () => {
    const { ctx, scope, persona } = await dispatching();
    const theirs = await taskIn(ctx, scope.projectId, { personaId: persona });
    await taskIn(ctx, scope.projectId);

    expect((await list(asCtx(ctx), scope, { personaId: persona })).map((t) => t.id)).toEqual([
      theirs
    ]);
  });

  it("narrows on both at once", async () => {
    const { ctx, scope, persona } = await dispatching();
    await taskIn(ctx, scope.projectId, { personaId: persona, status: "draft" });
    const wanted = await taskIn(ctx, scope.projectId, { personaId: persona, status: "running" });

    expect(
      (await list(asCtx(ctx), scope, { personaId: persona, status: "running" })).map((t) => t.id)
    ).toEqual([wanted]);
  });
});
