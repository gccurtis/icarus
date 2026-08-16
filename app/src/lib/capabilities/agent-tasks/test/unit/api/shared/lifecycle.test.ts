import { describe, expect, it } from "vitest";
import {
  completeTask,
  failTask,
  setPlan,
  startRun,
  waitForInput
} from "$agent-tasks/api/shared/lifecycle";
import { asCtx, dispatching, refusalFrom, taskIn } from "$agent-tasks/test/fixture";
import type { ContentBlock } from "$content/types/block";
import type { PlanStep } from "$agent-tasks/types/agent-task";

const answer: ContentBlock[] = [
  {
    id: "r1",
    type: "text",
    variant: "paragraph",
    atoms: [{ id: "r1a", kind: "literal", text: "Three competitors raised prices." }],
    display: "Three competitors raised prices.",
    marks: []
  }
];

describe("startRun", () => {
  it("dates the moment a queued task began", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId);

    await startRun(asCtx(ctx), scope, id);

    expect(ctx.rows.get(id)).toMatchObject({ status: "running" });
    expect(ctx.rows.get(id)?.startedAt).toBeTypeOf("number");
  });

  it("keeps the first start when a waiting task picks up again", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "waiting", startedAt: 1 });

    await startRun(asCtx(ctx), scope, id);

    // A task answered after an hour of waiting began when it began; restamping
    // would make the gap between creation and start unreadable.
    expect(ctx.rows.get(id)).toMatchObject({ status: "running", startedAt: 1 });
  });
});

describe("waitForInput", () => {
  it("parks a running task without stopping it", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "running", startedAt: 1 });

    await waitForInput(asCtx(ctx), scope, id);

    // Blocked on a person is not running and is not finished: it consumes
    // nothing, and there is nothing to date the end of.
    expect(ctx.rows.get(id)).toMatchObject({ status: "waiting", startedAt: 1 });
    expect(ctx.rows.get(id)?.finishedAt).toBeUndefined();
  });
});

describe("setPlan", () => {
  it("rewrites the checklist wholesale", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "running" });
    const first: PlanStep[] = [
      { description: "Read the pricing pages", status: "done" },
      { description: "Compare against ours", status: "pending" }
    ];

    await setPlan(asCtx(ctx), scope, id, first);
    await setPlan(asCtx(ctx), scope, id, [{ description: "Ask the customer", status: "active" }]);

    // The plan is allowed to be wrong. An agent that revises it rewrites the
    // list, and no history is kept — a record of intentions nobody acts on.
    expect(ctx.rows.get(id)?.plan).toEqual([{ description: "Ask the customer", status: "active" }]);
    expect(ctx.rows.get(id)).not.toHaveProperty("plans");
  });

  it("leaves the status where it was", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "waiting" });

    await setPlan(asCtx(ctx), scope, id, [{ description: "Wait", status: "pending" }]);

    expect(ctx.rows.get(id)).toMatchObject({ status: "waiting" });
  });

  it("refuses to plan work that has already stopped", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "complete" });

    expect(
      await refusalFrom(setPlan(asCtx(ctx), scope, id, [{ description: "More", status: "pending" }]))
    ).toMatchObject({ code: "already-finished" });
  });
});

describe("completeTask", () => {
  it("stores the deliverable as blocks and dates the finish", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "running", startedAt: 1 });

    await completeTask(asCtx(ctx), scope, id, answer);

    expect(ctx.rows.get(id)).toMatchObject({ status: "complete", result: answer, startedAt: 1 });
    expect(ctx.rows.get(id)?.finishedAt).toBeTypeOf("number");
  });

  it("is the task's own act, labelled by its title", async () => {
    const { ctx, scope, userId, persona } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, {
      status: "running",
      personaId: persona,
      origin: { kind: "user", userId }
    });

    await completeTask(asCtx(ctx), scope, id, answer);

    // The actor is the task, never the person who dispatched it — and the title
    // is the `detail` half of the label that names it in a feed months later.
    expect(ctx.log.at(-1)).toMatchObject({
      actor: { kind: "agent", taskId: id },
      verb: "completed",
      actorLabel: {
        kind: "agent",
        name: "Researcher",
        onBehalfOf: "Development User",
        detail: "Q3 competitive scan"
      }
    });
    expect(ctx.log.at(-1)?.actor).not.toMatchObject({ kind: "user" });
  });

  it("refuses a task somebody already cancelled", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "cancelled" });

    expect(await refusalFrom(completeTask(asCtx(ctx), scope, id, answer))).toMatchObject({
      code: "already-finished"
    });
    expect(ctx.rows.get(id)).toMatchObject({ status: "cancelled" });
    expect(ctx.rows.get(id)).not.toHaveProperty("result");
  });
});

describe("failTask", () => {
  it("says why, and leaves cancellation meaning something else", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "running" });

    await failTask(asCtx(ctx), scope, id, "The provider timed out");

    expect(ctx.rows.get(id)).toMatchObject({
      status: "failed",
      error: "The provider timed out"
    });
    expect(ctx.rows.get(id)?.finishedAt).toBeTypeOf("number");
  });

  it("can end a task that was waiting on somebody", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "waiting" });

    await failTask(asCtx(ctx), scope, id, "Nobody answered");

    expect(ctx.rows.get(id)).toMatchObject({ status: "failed" });
  });

  it("is the task's own act", async () => {
    const { ctx, scope } = await dispatching();
    const id = await taskIn(ctx, scope.projectId, { status: "running" });

    await failTask(asCtx(ctx), scope, id, "The provider timed out");

    expect(ctx.log.at(-1)).toMatchObject({
      actor: { kind: "agent", taskId: id },
      verb: "failed",
      detail: "The provider timed out"
    });
  });
});

describe("the lifecycle as a whole", () => {
  it("reaches all six states, and no two are the same state twice", async () => {
    const { ctx, scope } = await dispatching();
    const draft = await taskIn(ctx, scope.projectId);
    const running = await taskIn(ctx, scope.projectId, { status: "running" });
    const waiting = await taskIn(ctx, scope.projectId, { status: "running" });
    const complete = await taskIn(ctx, scope.projectId, { status: "running" });
    const failed = await taskIn(ctx, scope.projectId, { status: "running" });

    await startRun(asCtx(ctx), scope, draft);
    await waitForInput(asCtx(ctx), scope, waiting);
    await completeTask(asCtx(ctx), scope, complete, answer);
    await failTask(asCtx(ctx), scope, failed, "no");

    expect(
      [draft, running, waiting, complete, failed].map((id) => ctx.rows.get(id)?.status)
    ).toEqual(["running", "running", "waiting", "complete", "failed"]);
  });

  it("reports not found for a task in another project, whatever is asked of it", async () => {
    const { ctx, scope, elsewhere } = await dispatching();
    const theirs = await taskIn(ctx, elsewhere.projectId, { status: "running" });

    for (const call of [
      startRun(asCtx(ctx), scope, theirs),
      waitForInput(asCtx(ctx), scope, theirs),
      setPlan(asCtx(ctx), scope, theirs, []),
      completeTask(asCtx(ctx), scope, theirs, answer),
      failTask(asCtx(ctx), scope, theirs, "no")
    ]) {
      expect(await refusalFrom(call)).toMatchObject({ code: "not-found" });
    }
    expect(ctx.rows.get(theirs)).toMatchObject({ status: "running" });
  });
});
