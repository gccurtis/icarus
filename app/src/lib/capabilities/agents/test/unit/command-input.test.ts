import { describe, expect, it } from "vitest";

import { validateAnswerTaskQuestion } from "$capabilities/agents/api/answer-task-question/validate-answer-task-question";
import { validateCreateAutomation } from "$capabilities/agents/api/create-automation/validate-create-automation";
import { validateCreateTask } from "$capabilities/agents/api/create-task/validate-create-task";
import { validateReadAutomation } from "$capabilities/agents/api/read-automation/validate-read-automation";
import { validateReadPersona } from "$capabilities/agents/api/read-persona/validate-read-persona";
import { validateReadTask } from "$capabilities/agents/api/read-task/validate-read-task";
import { planOf } from "$capabilities/agents/api/shared/validation";
import { validateUpdateAutomation } from "$capabilities/agents/api/update-automation/validate-update-automation";
import { validateUpdatePersona } from "$capabilities/agents/api/update-persona/validate-update-persona";

const createTask = (extra: Record<PropertyKey, unknown> = {}) => ({
  personaId: "personas:1",
  title: "Current task",
  instruction: "Use current evidence.",
  tools: ["retrieve", "resource.read"],
  ...extra
});

const updateAutomation = (trigger: unknown) => ({
  automationId: "automations:1",
  baseRevision: 1,
  patch: { trigger }
});

describe("Agent command identity", () => {
  it("requires the nominal table namespace for every resource id", () => {
    expect(() => validateReadPersona({ personaId: "agentTasks:1" })).toThrow(/personas id/);
    expect(() => validateReadTask({ taskId: "automations:1" })).toThrow(/agentTasks id/);
    expect(() => validateReadAutomation({ automationId: "personas:1" })).toThrow(/automations id/);
    expect(() => validateCreateTask(createTask({ personaId: "users:1" }))).toThrow(/personas id/);
    expect(() => validateAnswerTaskQuestion({
      taskId: "threads:1",
      questionId: "choice",
      answer: "A"
    })).toThrow(/agentTasks id/);
  });

  it("rejects hidden, symbolic, and unknown own command fields", () => {
    const hidden = createTask();
    Object.defineProperty(hidden, "retired", { value: true, enumerable: false });
    expect(() => validateCreateTask(hidden)).toThrow(/exact current data object/);

    const symbolic = createTask() as Record<PropertyKey, unknown>;
    symbolic[Symbol("retired")] = true;
    expect(() => validateCreateTask(symbolic)).toThrow(/exact current data object/);
    expect(() => validateCreateTask(createTask({ retired: true }))).toThrow(/unknown field/);
  });

  it("rejects non-data command objects without invoking accessors", () => {
    const inherited = Object.create({ retired: true }) as Record<string, unknown>;
    Object.assign(inherited, createTask());
    expect(() => validateCreateTask(inherited)).toThrow(/exact current data object/);

    let reads = 0;
    const accessor = createTask();
    Object.defineProperty(accessor, "title", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "Accessor title";
      }
    });
    expect(() => validateCreateTask(accessor)).toThrow(/exact current data object/);
    expect(reads).toBe(0);

    expect(() => validateCreateTask(createTask({ scope: undefined }))).toThrow(
      /exact current data object/
    );

    const decoratedTools = ["retrieve", "resource.read"];
    Object.defineProperty(decoratedTools, "retired", { value: true, enumerable: false });
    expect(() => validateCreateTask(createTask({ tools: decoratedTools }))).toThrow(
      /exact current data object/
    );

    let nestedReads = 0;
    const accessorTools = ["retrieve", "resource.read"];
    Object.defineProperty(accessorTools, "0", {
      enumerable: true,
      get: () => {
        nestedReads += 1;
        return "retrieve";
      }
    });
    expect(() => validateCreateTask(createTask({ tools: accessorTools }))).toThrow(
      /exact current data object/
    );
    expect(nestedReads).toBe(0);
  });

  it("requires tools exactly once and in catalogue order", () => {
    expect(validateCreateTask(createTask()).tools).toEqual(["retrieve", "resource.read"]);
    expect(() => validateCreateTask(createTask({ tools: ["resource.read", "retrieve"] }))).toThrow(
      /catalogue order/
    );
    expect(() => validateCreateTask(createTask({ tools: ["retrieve", "retrieve"] }))).toThrow(
      /unique ids/
    );
  });
});

describe("Agent command variants", () => {
  it("requires exact weekly and non-weekly schedule arms", () => {
    expect(validateUpdateAutomation(updateAutomation({
      kind: "schedule",
      at: "07:00",
      repeats: "weekly",
      weekday: "Monday",
      timezone: "UTC"
    })).patch.trigger).toMatchObject({ repeats: "weekly", weekday: "Monday" });
    expect(() => validateUpdateAutomation(updateAutomation({
      kind: "schedule",
      at: "07:00",
      repeats: "weekly",
      timezone: "UTC"
    }))).toThrow(/weekday/);
    expect(() => validateUpdateAutomation(updateAutomation({
      kind: "schedule",
      at: "07:00",
      repeats: "daily",
      weekday: "Monday",
      timezone: "UTC"
    }))).toThrow(/unknown field weekday/);
    expect(() => validateUpdateAutomation(updateAutomation({
      kind: "schedule",
      at: "07:00",
      repeats: "daily",
      weekday: undefined,
      timezone: "UTC"
    }))).toThrow(/exact current data object/);
  });

  it("requires unique catalogue-ordered trigger kinds and omitted absent references", () => {
    expect(() => validateUpdateAutomation(updateAutomation({
      kind: "resource-created",
      kinds: ["presentation", "document"]
    }))).toThrow(/catalogue order/);
    expect(() => validateUpdateAutomation(updateAutomation({
      kind: "resource-created",
      kinds: ["document", "document"]
    }))).toThrow(/duplicate selector/);
    expect(() => validateUpdateAutomation(updateAutomation({
      kind: "resource-edited",
      kinds: ["document"],
      ref: undefined
    }))).toThrow(/exact current data object/);
    expect(() => validateUpdateAutomation(updateAutomation({
      kind: "resource-edited",
      kinds: ["document"],
      ref: { kind: "document", id: "spreadsheets:1" }
    }))).toThrow(/exact current resource reference/);
  });

  it("requires a complete cast and exact local entry ids", () => {
    expect(() => validateUpdatePersona({
      personaId: "personas:1",
      baseRevision: 1,
      patch: { cast: { strength: "high", speed: "medium" } }
    })).toThrow(/cast label/);
    expect(() => validateAnswerTaskQuestion({
      taskId: "agentTasks:1",
      questionId: "questions:choice",
      answer: "A"
    })).toThrow(/short identifier/);
  });

  it("requires unique plan ids and one monotonic procedural frontier", () => {
    expect(() => planOf([
      { id: "same", title: "One", state: "done" },
      { id: "same", title: "Two", state: "pending" }
    ], "test")).toThrow(/ids are unique/);
    expect(() => planOf([
      { id: "later", title: "Later", state: "pending" },
      { id: "earlier", title: "Earlier", state: "done" }
    ], "test")).toThrow(/proceed/);
    expect(() => planOf([
      { id: "one", title: "One", state: "active" },
      { id: "two", title: "Two", state: "active" }
    ], "test")).toThrow(/proceed/);
  });

  it("does not permit an empty cast label or silently invent one", () => {
    expect(() => validateCreateAutomation({
      personaId: "personas:1",
      name: "Rule",
      trigger: { kind: "manual" },
      tools: []
    })).not.toThrow();
    expect(() => validateUpdatePersona({
      personaId: "personas:1",
      baseRevision: 1,
      patch: { cast: { label: "", strength: "high", speed: "medium" } }
    })).toThrow(/cast label is required/);
  });
});
