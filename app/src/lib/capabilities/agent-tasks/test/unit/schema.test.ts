import { describe, expect, it } from "vitest";
import { validate } from "convex-helpers/validators";
import { agentTasksTables } from "$agent-tasks/schema";
import { blockValidator } from "$content/types/block";
import { actorValidator } from "$shared/types/actor";

const fields = () => agentTasksTables.agentTasks.validator.fields;
const indexes = () => agentTasksTables.agentTasks[" indexes"]();

/**
 * A unit of work handed to an agent. The schema is where three claims are either
 * true or quietly abandoned: that the row *is* the thread, that the three names
 * stay three, and that dispatching does not make the dispatcher the actor.
 */
describe("agentTasks schema", () => {
  it("leads every index with projectId", () => {
    expect(indexes().length).toBeGreaterThan(0);
    for (const index of indexes()) expect(index.fields[0]).toBe("projectId");
  });

  it("answers 'what is running' and 'what has this persona done' in one indexed read", () => {
    const byStatus = indexes().find((index) => index.indexDescriptor === "by_project_status");
    const byPersona = indexes().find((index) => index.indexDescriptor === "by_persona");

    expect(byStatus?.fields.slice(0, 2)).toEqual(["projectId", "status"]);
    expect(byPersona?.fields.slice(0, 2)).toEqual(["projectId", "personaId"]);
  });

  it("holds what the model states and nothing else", () => {
    expect(Object.keys(fields()).sort()).toEqual(
      [
        "projectId",
        "title",
        "prompt",
        "description",
        "personaId",
        "branchedFrom",
        "status",
        "origin",
        "plan",
        "result",
        "error",
        "startedAt",
        "finishedAt",
        "updatedAt"
      ].sort()
    );
  });

  it("is itself the thread, so nothing here names a conversation", () => {
    // Messages name this row through `by_thread(("task", id))`. A `chatId` would
    // be a second link to keep in step with the index that already works.
    expect(fields()).not.toHaveProperty("chatId");
    expect(fields()).not.toHaveProperty("threadId");
    expect(fields()).not.toHaveProperty("messages");
  });

  it("keeps tool calls on the message that made them", () => {
    // Every tool's payload is different, and the turn that called it is the only
    // place its input and output mean anything.
    expect(fields()).not.toHaveProperty("toolCalls");
  });

  it("keeps three names for three jobs", () => {
    // `prompt` is provenance and never rewritten, `title` is the label, and
    // `description` is the summary that would have destroyed the first if it
    // had been allowed to overwrite it.
    expect(fields().prompt.isOptional).toBe("required");
    expect(fields().title.isOptional).toBe("required");
    expect(fields().description.isOptional).toBe("optional");
  });

  it("names the six states a task can be in", () => {
    expect(fields().status.members.map((member: { value: string }) => member.value).sort()).toEqual(
      ["cancelled", "complete", "draft", "failed", "running", "waiting"]
    );

    // `queued` would be `draft`, `stopped` would collapse cancelled into failed.
    expect(validate(fields().status, "queued")).toBe(false);
    expect(validate(fields().status, "stopped")).toBe(false);
  });

  it("records who dispatched it as an actor, so another task can be the answer", () => {
    expect(fields().origin).toBe(actorValidator);
    expect(fields().origin.isOptional).toBe("required");
    expect(validate(fields().origin, { kind: "agent", taskId: "agentTasks:1" })).toBe(true);
  });

  it("carries the plan as a checklist rather than a graph", () => {
    // Dependencies, branching, and retries are execution concerns. What is worth
    // storing is what the agent said it would do and how far it got.
    expect(fields().plan.isOptional).toBe("optional");
    expect(Object.keys(fields().plan.element.fields).sort()).toEqual(["description", "status"]);
    expect(
      fields().plan.element.fields.status.members.map((member: { value: string }) => member.value)
    ).toEqual(["pending", "active", "done", "skipped", "failed"]);
  });

  it("holds the deliverable as content blocks", () => {
    // The output is content — an answer, a table, a chart — extracted rather
    // than left for somebody to find by reading the whole thread.
    expect(fields().result.element).toBe(blockValidator);
    expect(fields().result.isOptional).toBe("optional");
  });

  it("records the persona chat message it was spun off from", () => {
    const branchedFrom = fields().branchedFrom;

    expect(branchedFrom.isOptional).toBe("optional");
    expect(Object.keys(branchedFrom.fields).sort()).toEqual(["messageId", "threadId"]);
    expect(branchedFrom.fields.threadId.tableName).toBe("personaThreads");
    expect(branchedFrom.fields.messageId.tableName).toBe("messages");
  });

  it("keeps beginning and stopping apart, and stores neither for creation", () => {
    // `_creationTime` is when it came into existence; a queued task and a
    // running one are not the same thing, and the gap is worth seeing.
    expect(fields()).not.toHaveProperty("createdAt");
    expect(fields().startedAt.isOptional).toBe("optional");
    expect(fields().finishedAt.isOptional).toBe("optional");
  });
});
