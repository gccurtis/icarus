import { describe, expect, it } from "vitest";

import {
  filterRows,
  isNew,
  nextName,
  pendingReviewIn,
  presetPersonaOf,
  sortRows,
  taskRowOf,
  toolChange,
  type TaskRow
} from "$app-views/categories/agents/procedures/library.svelte";
import type { TaskItem } from "$capabilities/agents/index.remote";

const NOW = 1_000_000;

const item = (id: string, extra: Partial<TaskItem> = {}): TaskItem => ({
  id,
  title: `Task ${id}`,
  personaId: "personas:a",
  personaName: "Analyst",
  state: "running",
  origin: { kind: "person" },
  automationName: null,
  startedAt: NOW - 60_000,
  finishedAt: null,
  startedByName: "Uma",
  progress: { done: 0, total: 0, percent: null, current: null },
  openQuestions: 0,
  outputCount: 0,
  scope: null,
  tools: ["retrieve"],
  revision: 1,
  updatedAt: NOW,
  ...extra
});

const rows: readonly TaskRow[] = [
  taskRowOf(item("1"), NOW),
  taskRowOf(
    item("2", {
      state: "review",
      finishedAt: NOW - 30_000,
      origin: { kind: "automation", automationId: "automations:x" as never, trigger: "schedule" },
      startedAt: NOW - 120_000
    }),
    NOW
  ),
  taskRowOf(
    item("3", { state: "finished", finishedAt: NOW - 5_000, personaId: "personas:b", personaName: "Editor", startedAt: NOW - 600_000 }),
    NOW
  )
];

describe("agents library procedures", () => {
  it("labels a task by how it came to run", () => {
    expect(rows[0].typeLabel).toBe("Once");
    expect(rows[1].typeLabel).toBe("Scheduled");
    expect(rows[0].started).toBe("1 minute ago");
    expect(rows[2].took).toBe("10 min");
  });

  it("narrows by persona, type, state and words", () => {
    expect(filterRows(rows, { persona: "personas:b", query: "", kind: "any", state: "any" }).map((row) => row.id)).toEqual(["3"]);
    expect(filterRows(rows, { persona: "any", query: "", kind: "schedule", state: "any" }).map((row) => row.id)).toEqual(["2"]);
    expect(filterRows(rows, { persona: "any", query: "", kind: "any", state: "review" }).map((row) => row.id)).toEqual(["2"]);
    expect(filterRows(rows, { persona: "any", query: "editor", kind: "any", state: "any" }).map((row) => row.id)).toEqual(["3"]);
  });

  it("sorts with an explicit direction and puts what needs you first", () => {
    expect(sortRows(rows, "started", "asc").map((row) => row.id)).toEqual(["1", "2", "3"]);
    expect(sortRows(rows, "started", "desc").map((row) => row.id)).toEqual(["3", "2", "1"]);
    expect(sortRows(rows, "state", "asc").map((row) => row.id)).toEqual(["2", "1", "3"]);
    expect(sortRows(rows, "title", "desc").map((row) => row.id)).toEqual(["3", "2", "1"]);
  });

  it("lists the tasks pending review newest finished first", () => {
    expect(pendingReviewIn(rows).map((row) => row.id)).toEqual(["2"]);
  });

  it("names a tool grant relative to the persona defaults", () => {
    expect(toolChange(["retrieve"], ["retrieve"], "retrieve")).toBe("default");
    expect(toolChange(["retrieve", "web.search"], ["retrieve"], "web.search")).toBe("added");
    expect(toolChange([], ["retrieve"], "retrieve")).toBe("removed");
    expect(toolChange([], [], "retrieve")).toBe("off");
  });

  it("reads a draft focus and its preset persona", () => {
    expect(isNew(undefined)).toBe(true);
    expect(isNew("new")).toBe(true);
    expect(isNew("new:personas:a")).toBe(true);
    expect(isNew("agentTasks:1")).toBe(false);
    expect(presetPersonaOf("new:personas:a")).toBe("personas:a");
    expect(presetPersonaOf("new")).toBeUndefined();
  });

  it("picks the next free working name", () => {
    expect(nextName("Untitled persona", [])).toBe("Untitled persona");
    expect(nextName("Untitled persona", ["untitled persona"])).toBe("Untitled persona 2");
    expect(nextName("Untitled persona", ["Untitled persona", "Untitled persona 2"])).toBe("Untitled persona 3");
  });
});
