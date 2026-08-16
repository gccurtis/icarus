import { describe, expect, it } from "vitest";
import {
  hasFinished,
  taskActor,
  taskPrompt,
  taskTitle,
  type AgentTaskStatus
} from "$agent-tasks/types/agent-task";
import {
  asCtx,
  dispatching,
  refusalFrom,
  rowsOf,
  taskIn,
  undoableBy
} from "$agent-tasks/test/fixture";
import { emptyDocumentBody } from "$documents/types/body";
import { start } from "$revisions/api/shared/start";
import { submit } from "$revisions/api/submit/submit";
import type { Op } from "$revisions/types/change";

const RESOURCE = { resourceType: "document", resourceId: "documents:1" } as const;

const typing: Op = {
  op: "text",
  target: "atom",
  path: "#b7x2/atoms/#a9x1",
  at: 0,
  insert: "Rewritten by the agent",
  remove: ""
};

describe("taskTitle", () => {
  it("trims, because a title is a label somebody reads", () => {
    expect(taskTitle("  Q3 competitive scan  ")).toBe("Q3 competitive scan");
  });

  it("refuses a task nothing in a feed could identify", async () => {
    expect(await refusalFrom(Promise.resolve().then(() => taskTitle("   ")))).toMatchObject({
      code: "empty-title"
    });
  });
});

describe("taskPrompt", () => {
  it("keeps the instruction exactly as it was written", () => {
    // Verbatim: this is what gets sent to the model and it is the task's
    // provenance. Trimming it here would be the first rewrite, and the argument
    // against every later one is that there are none.
    const written = "  Scan the market.\n\nInclude sources.  ";

    expect(taskPrompt(written)).toBe(written);
  });

  it("refuses a task with no instruction to run", async () => {
    expect(await refusalFrom(Promise.resolve().then(() => taskPrompt(" \n ")))).toMatchObject({
      code: "empty-prompt"
    });
  });
});

describe("hasFinished", () => {
  it("counts the three ways a task stops and no others", () => {
    const stopped: AgentTaskStatus[] = ["complete", "failed", "cancelled"];
    const going: AgentTaskStatus[] = ["draft", "running", "waiting"];

    for (const status of stopped) expect(hasFinished(status)).toBe(true);
    for (const status of going) expect(hasFinished(status)).toBe(false);
  });
});

describe("taskActor", () => {
  it("names the task, never the persona behind it", () => {
    // A task already carries `personaId`, so storing both would let them
    // disagree — and a particular run is the more specific truth about what
    // acted.
    expect(taskActor("agentTasks:1" as never)).toEqual({ kind: "agent", taskId: "agentTasks:1" });
  });

  it("keeps a task's edits out of the dispatcher's undo stack", async () => {
    const { ctx, scope, userId } = await dispatching();
    const taskId = await taskIn(ctx, scope.projectId, {
      status: "running",
      origin: { kind: "user", userId }
    });
    await start(asCtx(ctx), scope, RESOURCE, emptyDocumentBody());

    await submit(asCtx(ctx), scope, { ...RESOURCE, baseRevision: 0, ops: [typing] }, taskActor(taskId));

    // Dispatching does not make the dispatcher the actor of what the task did.
    const [set] = rowsOf(ctx, "changeSets");
    expect(set.actor).toEqual({ kind: "agent", taskId });
    expect(set.actor).not.toMatchObject({ kind: "user" });
    expect(undoableBy(ctx, userId)).toHaveLength(0);
  });

  it("still attributes a person's own edit to the person", async () => {
    const { ctx, scope, userId } = await dispatching();
    await start(asCtx(ctx), scope, RESOURCE, emptyDocumentBody());

    await submit(asCtx(ctx), scope, { ...RESOURCE, baseRevision: 0, ops: [typing] });

    expect(undoableBy(ctx, userId)).toHaveLength(1);
  });
});
