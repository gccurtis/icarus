import { describe, expect, it } from "vitest";
import { read } from "$agent-tasks/api/read/read";
import { asCtx, dispatching, refusalFrom, taskIn } from "$agent-tasks/test/fixture";

describe("read", () => {
  it("opens a task by its own address, with the prompt it was given", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "running" });

    expect(await read(asCtx(ctx), scope, id)).toMatchObject({
      id,
      title: "Q3 competitive scan",
      prompt: "Scan the market for pricing moves since April.",
      status: "running"
    });
  });

  it("reports not found for a task in another project", async () => {
    const { ctx, scope, elsewhere } = await dispatching();
    const theirs = await taskIn(ctx, elsewhere.projectId);

    expect(await refusalFrom(read(asCtx(ctx), scope, theirs))).toMatchObject({ code: "not-found" });
  });
});
