import { describe, expect, it } from "vitest";
import { dispatch } from "$agent-tasks/api/dispatch/dispatch";
import { asCtx, dispatching, refusalFrom, rowsOf, taskIn } from "$agent-tasks/test/fixture";
import { taskActor } from "$agent-tasks/types/agent-task";
import { list as listTurns } from "$messages/api/list/list";
import { post } from "$messages/api/post/post";
import { personasRefusal } from "$personas/errors";

const GOAL = {
  title: "Q3 competitive scan",
  prompt: "Scan the market for pricing moves since April."
};

describe("dispatch", () => {
  it("scopes what it creates to the caller's project", async () => {
    const { ctx, scope, userId, persona } = await dispatching();

    const id = await dispatch(
      asCtx(ctx),
      scope,
      { kind: "user", userId },
      { ...GOAL, personaId: persona, description: "Pricing since April" }
    );

    expect(ctx.rows.get(id)).toMatchObject({
      projectId: scope.projectId,
      title: "Q3 competitive scan",
      description: "Pricing since April",
      personaId: persona,
      status: "draft",
      origin: { kind: "user", userId }
    });
    expect(ctx.log.at(-1)).toMatchObject({
      verb: "dispatched",
      target: { type: "agentTask", id, label: "Q3 competitive scan" }
    });
  });

  it("is itself the thread, so it opens no conversation beside it", async () => {
    const { ctx, scope, userId } = await dispatching();

    const id = await dispatch(asCtx(ctx), scope, { kind: "user", userId }, GOAL);

    // Messages name this row; `by_thread(("task", id))` is the whole link.
    expect(ctx.rows.get(id)).not.toHaveProperty("chatId");
    expect(rowsOf(ctx, "messages")).toHaveLength(1); // the chat's own turn, untouched
  });

  it("can be spoken in the moment it returns, and the turn carries the tool calls", async () => {
    const { ctx, scope, userId } = await dispatching();
    const id = await dispatch(asCtx(ctx), scope, { kind: "user", userId }, GOAL);

    await post(asCtx(ctx), scope, {
      thread: { kind: "task", id },
      role: "response",
      blocks: [],
      toolCalls: [
        { name: "search", input: { query: "pricing" }, output: [{ url: "x" }], state: "success" }
      ]
    });

    // The tool call sits on the turn that made it, with its payload
    // uninterpreted on both sides — every tool's is different, and the tool is
    // the only thing that can read its own arguments.
    const [turn] = await listTurns(asCtx(ctx), scope, { kind: "task", id });
    expect(turn.toolCalls).toEqual([
      { name: "search", input: { query: "pricing" }, output: [{ url: "x" }], state: "success" }
    ]);
  });

  it("has not begun, so it stamps no start and no finish", async () => {
    const { ctx, scope, userId } = await dispatching();

    const id = await dispatch(asCtx(ctx), scope, { kind: "user", userId }, GOAL);

    expect(ctx.rows.get(id)?.startedAt).toBeUndefined();
    expect(ctx.rows.get(id)?.finishedAt).toBeUndefined();
    expect(ctx.rows.get(id)?._creationTime).toBeTypeOf("number");
  });

  it("stores the kickoff instruction verbatim and the title trimmed", async () => {
    const { ctx, scope, userId } = await dispatching();
    const prompt = "  Scan the market.\n\nInclude sources.  ";

    const id = await dispatch(asCtx(ctx), scope, { kind: "user", userId }, {
      title: "  Q3 competitive scan  ",
      prompt
    });

    // The prompt is what gets sent to the model and it is the provenance of
    // everything the task does, so nothing rewrites it — not even a trim.
    expect(ctx.rows.get(id)).toMatchObject({ prompt, title: "Q3 competitive scan" });
  });

  it("records a dispatching task as the origin, never the person behind it", async () => {
    const { ctx, scope, userId, persona } = await dispatching();
    const parent = await taskIn(ctx, scope.projectId, {
      status: "running",
      personaId: persona,
      origin: { kind: "user", userId }
    });

    const child = await dispatch(asCtx(ctx), scope, taskActor(parent), {
      title: "Read the pricing page",
      prompt: "Fetch and summarize competitor pricing."
    });

    // An agent origin's taskId is the parent, which is what makes a tree of
    // delegated work have a root and a runaway loop visible as depth.
    expect(ctx.rows.get(child)).toMatchObject({ origin: { kind: "agent", taskId: parent } });
    expect(ctx.rows.get(child)?.origin).not.toMatchObject({ kind: "user" });
    // And the feed still says who is accountable for it having happened at all.
    expect(ctx.log.at(-1)?.actorLabel).toMatchObject({
      name: "Researcher",
      onBehalfOf: "Development User",
      detail: "Q3 competitive scan"
    });
  });

  it("reports not found for a parent task in another project", async () => {
    const { ctx, scope, elsewhere } = await dispatching();
    const theirs = await taskIn(ctx, elsewhere.projectId);

    expect(
      await refusalFrom(dispatch(asCtx(ctx), scope, taskActor(theirs), GOAL))
    ).toMatchObject({ code: "not-found" });
    expect(rowsOf(ctx, "agentTasks")).toHaveLength(1);
  });

  it("inherits a chat up to a message, and touches the chat", async () => {
    const { ctx, scope, userId, threadId, messageId } = await dispatching();
    const before = rowsOf(ctx, "messages");

    const id = await dispatch(asCtx(ctx), scope, { kind: "user", userId }, {
      ...GOAL,
      branchedFrom: { threadId, messageId }
    });

    expect(ctx.rows.get(id)).toMatchObject({ branchedFrom: { threadId, messageId } });
    // What came before is reached through the reference; copying it would be a
    // second version of an append-only log, free to disagree with the first.
    expect(rowsOf(ctx, "messages")).toEqual(before);
  });

  it("reports not found for a persona in another project", async () => {
    const { ctx, scope, userId, theirPersona } = await dispatching();

    // The refusal is the personas capability's, unchanged: it owns "absent means
    // yours too", and restating it here is how two answers start to differ.
    const refusal = await dispatch(asCtx(ctx), scope, { kind: "user", userId }, {
      ...GOAL,
      personaId: theirPersona
    }).then(
      () => undefined,
      (error: unknown) => personasRefusal(error)
    );

    expect(refusal).toMatchObject({ capability: "personas", code: "not-found" });
    expect(rowsOf(ctx, "agentTasks")).toHaveLength(0);
  });

  it("refuses a task nobody could identify in a feed, and one with nothing to run", async () => {
    const { ctx, scope, userId } = await dispatching();
    const by = { kind: "user", userId } as const;

    expect(await refusalFrom(dispatch(asCtx(ctx), scope, by, { ...GOAL, title: " " }))).toMatchObject(
      { code: "empty-title" }
    );
    expect(
      await refusalFrom(dispatch(asCtx(ctx), scope, by, { ...GOAL, prompt: "\n" }))
    ).toMatchObject({ code: "empty-prompt" });
    expect(rowsOf(ctx, "agentTasks")).toHaveLength(0);
  });
});
