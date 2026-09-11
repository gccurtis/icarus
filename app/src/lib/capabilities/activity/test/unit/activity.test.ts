import { describe, expect, it } from "vitest";

import {
  activityPresentation,
  recordAgentTaskCompletedActivity
} from "$capabilities/activity";
import { asId } from "$representation/data/behavior/core/id";
import { defineStore } from "$model/server/store/index.server";
import { isStoredActivity } from "$representation/data/behavior/collaboration/stored-activity";
import type { ActivityEvent } from "$representation/data/types/collaboration/activity";

const file = {
  id: asId<"externalFiles">("externalFiles:one"),
  name: "report.pdf",
  relativePath: "Archive/report.pdf"
};
const task = { id: asId<"agentTasks">("agentTasks:one"), title: "Check the filing" };
const persona = { id: asId<"personas">("personas:one"), name: "Source Checker" };

const events: readonly ActivityEvent[] = [
  { kind: "external-file.uploaded", file, size: 28_000, mediaType: "application/pdf" },
  { kind: "external-file.reuploaded", file, replacementName: "revised.pdf", size: 31_000, revision: 2 },
  {
    kind: "external-file.renamed",
    file,
    previousName: "draft.pdf",
    previousRelativePath: "Archive/draft.pdf"
  },
  { kind: "external-file.moved", file, previousRelativePath: "Intake/report.pdf" },
  { kind: "external-file.context-changed", file, change: "set" },
  { kind: "external-file.deleted", file, size: 31_000, revision: 4 },
  { kind: "agents.task-started", task, persona, origin: { kind: "person" } },
  { kind: "agents.task-completed", task, persona, outcome: "answered", sourceCount: 2 }
];

const stored = (event: ActivityEvent) => ({
  _id: "activity:one",
  _creationTime: 10,
  projectId: "projects:one",
  actor: event.kind === "agents.task-completed"
    ? { kind: "agent", taskId: "agentTasks:one" }
    : { kind: "user", userId: "users:one" },
  actorLabel: event.kind === "agents.task-completed" ? "Source Checker" : "Uma",
  event
});

describe("Activity contract", () => {
  it("admits every declared event and gives each one a useful shared presentation", () => {
    expect(events.every((event) => isStoredActivity(stored(event)))).toBe(true);
    expect(events.map((event) => activityPresentation(event).what)).toEqual([
      "Uploaded 28 KB PDF",
      "Replaced file contents",
      "Renamed “draft.pdf” to “report.pdf”",
      "Moved from /Intake to /Archive",
      "Added dataset context",
      "Deleted 31 KB file",
      "Started an Agents task",
      "Completed an Agents task"
    ]);
  });

  it("rejects free-form rows, extra event fields, and mismatched task actors", () => {
    expect(isStoredActivity({
      ...stored(events[0]!),
      event: undefined,
      verb: "uploaded",
      target: { kind: "external-file", id: file.id, label: file.name }
    })).toBe(false);
    expect(isStoredActivity({
      ...stored(events[0]!),
      event: { ...events[0], detail: "untyped" }
    })).toBe(false);
    expect(isStoredActivity({
      ...stored(events[7]!),
      actor: { kind: "agent", taskId: "agentTasks:other" }
    })).toBe(false);
    expect(isStoredActivity({
      ...stored(events[6]!),
      actor: { kind: "agent", taskId: "agentTasks:one" }
    })).toBe(false);
  });

  it("records only the first completion for one task", () => {
    const store = defineStore({ now: () => 20 });
    const personaId = store.create("personas", {
      projectId: asId<"projects">("projects:one"),
      name: persona.name,
      definition: {
        focus: "Check sources.",
        background: "A filing review.",
        approach: "Read the source.",
        outputPreferences: "Answer briefly.",
        verification: "Cite each claim."
      },
      tools: ["retrieve"],
      createdBy: { kind: "user", userId: asId<"users">("users:one") },
      revision: 1,
      updatedAt: 10
    });
    const taskId = store.create("agentTasks", {
      projectId: asId<"projects">("projects:one"),
      threadId: asId<"threads">("threads:one"),
      title: task.title,
      instruction: "Check it.",
      personaId,
      origin: { kind: "person" },
      state: "review",
      tools: ["retrieve"],
      plan: [],
      outputs: [],
      questions: [],
      createdBy: { kind: "user", userId: asId<"users">("users:one") },
      startedAt: 10,
      finishedAt: 20,
      revision: 1,
      updatedAt: 20
    });
    const completion: Extract<ActivityEvent, { kind: "agents.task-completed" }> = {
      kind: "agents.task-completed",
      task: { id: taskId, title: task.title },
      persona: { id: personaId, name: persona.name },
      outcome: "answered",
      sourceCount: 2
    };

    const first = store.transaction((unit) => recordAgentTaskCompletedActivity(
      unit,
      asId<"projects">("projects:one"),
      completion
    ));
    const second = store.transaction((unit) => recordAgentTaskCompletedActivity(
      unit,
      asId<"projects">("projects:one"),
      { ...completion, sourceCount: 3 }
    ));

    expect(second).toBe(first);
    expect(store.read("activity")).toMatchObject({ kind: "table", rows: [{ _id: first }] });
  });
});
