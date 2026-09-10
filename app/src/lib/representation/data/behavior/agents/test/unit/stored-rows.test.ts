import { describe, expect, it } from "vitest";

import {
  isStoredAgentTask,
  isStoredAutomation
} from "$representation/data/behavior/agents/stored-rows";

const actor = { kind: "user", userId: "users:1" } as const;

const task = () => ({
  _id: "agentTasks:1",
  _creationTime: 1,
  projectId: "default",
  threadId: "threads:1",
  title: "Reconcile the record",
  instruction: "Use the project evidence.",
  personaId: "personas:1",
  origin: { kind: "person" },
  state: "running",
  execution: { kind: "grounded" },
  tools: ["retrieve", "resource.read"],
  plan: [
    { id: "read", title: "Read", state: "done" },
    { id: "compare", title: "Compare", state: "active" },
    { id: "report", title: "Report", state: "pending" }
  ],
  outputs: [{ id: "finding", title: "Current finding", at: 3 }],
  questions: [{ id: "choice", text: "Which record?", askedAt: 2, state: "open" }],
  createdBy: actor,
  startedAt: 1,
  revision: 1,
  updatedAt: 3
});

const automation = () => ({
  _id: "automations:1",
  _creationTime: 1,
  projectId: "default",
  name: "Weekly review",
  personaId: "personas:1",
  instruction: "Review the record.",
  trigger: {
    kind: "schedule",
    at: "07:00",
    repeats: "weekly",
    weekday: "Monday",
    timezone: "UTC"
  },
  tools: ["retrieve", "resource.read"],
  enabled: true,
  firedCount: 0,
  createdBy: actor,
  revision: 1,
  updatedAt: 1
});

const without = (value: Record<string, unknown>, field: string): Record<string, unknown> => {
  const copy = { ...value };
  delete copy[field];
  return copy;
};

describe("current Agent task storage", () => {
  it("requires one complete state-specific lifecycle arm", () => {
    expect(isStoredAgentTask(task())).toBe(true);
    expect(isStoredAgentTask(without(task(), "execution"))).toBe(false);
    expect(isStoredAgentTask({ ...task(), state: "queued" })).toBe(false);
    expect(isStoredAgentTask({ ...task(), state: "review", finishedAt: 4 })).toBe(false);
    expect(isStoredAgentTask({ ...without(task(), "execution"), state: "review", finishedAt: 4 })).toBe(true);
    expect(isStoredAgentTask({ ...without(task(), "execution"), state: "finished" })).toBe(false);
    expect(isStoredAgentTask({
      ...without(task(), "execution"),
      state: "finished",
      finishedAt: 4,
      reviewedBy: actor
    })).toBe(true);
    expect(isStoredAgentTask({ ...task(), state: "finished", finishedAt: 4 })).toBe(false);
  });

  it("does not infer the executor from a familiar plan", () => {
    const familiarPlan = [
      { id: "ground-scope", title: "Ground scope", state: "pending" },
      { id: "ground-answer", title: "Ground answer", state: "pending" },
      { id: "ground-publish", title: "Ground publish", state: "pending" }
    ];
    expect(isStoredAgentTask({ ...without(task(), "execution"), plan: familiarPlan })).toBe(false);
    expect(isStoredAgentTask({ ...task(), execution: { kind: "retired-runner" } })).toBe(false);
  });

  it("requires unique catalogue-ordered tools, ids, and plan progression", () => {
    expect(isStoredAgentTask({ ...task(), tools: ["resource.read", "retrieve"] })).toBe(false);
    expect(isStoredAgentTask({ ...task(), tools: ["retrieve", "retrieve"] })).toBe(false);
    expect(isStoredAgentTask({ ...task(), plan: [task().plan[0], task().plan[0]] })).toBe(false);
    expect(isStoredAgentTask({
      ...task(),
      plan: [
        { id: "pending", title: "Pending", state: "pending" },
        { id: "done", title: "Done", state: "done" }
      ]
    })).toBe(false);
    expect(isStoredAgentTask({
      ...task(),
      plan: [
        { id: "active-1", title: "One", state: "active" },
        { id: "active-2", title: "Two", state: "active" }
      ]
    })).toBe(false);
    expect(isStoredAgentTask({ ...task(), outputs: [task().outputs[0], task().outputs[0]] })).toBe(false);
  });

  it("requires exact question lifecycle arms tied to this plan", () => {
    const open = task().questions[0];
    const answered = {
      ...open,
      state: "answered",
      answer: "The current record.",
      answeredAt: 3,
      answeredBy: actor
    };
    const rejected = {
      ...open,
      state: "rejected",
      rejectedAt: 3,
      answeredBy: actor
    };
    expect(isStoredAgentTask({ ...task(), questions: [answered] })).toBe(true);
    expect(isStoredAgentTask({ ...task(), questions: [rejected] })).toBe(true);
    expect(isStoredAgentTask({ ...task(), questions: [{ ...open, answer: undefined }] })).toBe(false);
    expect(isStoredAgentTask({ ...task(), questions: [{ ...answered, rejectedAt: 3 }] })).toBe(false);
    expect(isStoredAgentTask({ ...task(), questions: [{ ...rejected, answer: "mixed" }] })).toBe(false);
    expect(isStoredAgentTask({ ...task(), questions: [{ ...open, stepId: "missing" }] })).toBe(false);
    expect(isStoredAgentTask({ ...task(), questions: [open, open] })).toBe(false);
    expect(isStoredAgentTask({ ...task(), questions: [{ ...answered, answeredAt: 0 }] })).toBe(false);
  });

  it("rejects optional references that are present without a current value", () => {
    expect(isStoredAgentTask({
      ...task(),
      origin: {
        kind: "automation",
        automationId: "automations:1",
        trigger: "resource-edited",
        ref: undefined
      }
    })).toBe(false);
    expect(isStoredAgentTask({
      ...task(),
      outputs: [{ ...task().outputs[0], ref: undefined }]
    })).toBe(false);
  });
});

describe("current Agent automation storage", () => {
  it("requires exact schedule arms", () => {
    expect(isStoredAutomation(automation())).toBe(true);
    expect(isStoredAutomation({
      ...automation(),
      trigger: { kind: "schedule", at: "07:00", repeats: "daily", timezone: "UTC" }
    })).toBe(true);
    expect(isStoredAutomation({
      ...automation(),
      trigger: { kind: "schedule", at: "07:00", repeats: "weekly", timezone: "UTC" }
    })).toBe(false);
    expect(isStoredAutomation({
      ...automation(),
      trigger: {
        kind: "schedule",
        at: "07:00",
        repeats: "daily",
        weekday: "Monday",
        timezone: "UTC"
      }
    })).toBe(false);
    expect(isStoredAutomation({
      ...automation(),
      trigger: {
        kind: "schedule",
        at: "07:00",
        repeats: "daily",
        weekday: undefined,
        timezone: "UTC"
      }
    })).toBe(false);
  });

  it("requires unique catalogue-ordered selectors and exact optional references", () => {
    expect(isStoredAutomation({
      ...automation(),
      trigger: { kind: "resource-created", kinds: ["slides", "document"] }
    })).toBe(false);
    expect(isStoredAutomation({
      ...automation(),
      trigger: { kind: "resource-created", kinds: ["document", "document"] }
    })).toBe(false);
    expect(isStoredAutomation({
      ...automation(),
      trigger: { kind: "resource-edited", kinds: ["document"], ref: undefined }
    })).toBe(false);
  });
});
