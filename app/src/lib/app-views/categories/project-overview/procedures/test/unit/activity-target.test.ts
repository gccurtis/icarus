import { describe, expect, it } from "vitest";

import {
  activityDestinationSource,
  currentActivityDestination,
  currentActivityResource,
  openingForActivityDestination,
  type ActivityAgentIndex,
  type ActivityResource
} from "$app-views/categories/project-overview/procedures/activity-target";

const resources: readonly ActivityResource[] = [
  { id: "documents:1", kind: "document" },
  { id: "presentations:1", kind: "presentation" },
  { id: "spreadsheets:1", kind: "spreadsheet" },
  { id: "researchThreads:1", kind: "research" },
  { id: "findings:1", kind: "finding" },
  { id: "externalFiles:1", kind: "file" }
];

const agents: ActivityAgentIndex = {
  personas: [{ id: "personas:1" }],
  tasks: [{ id: "agentTasks:1" }],
  automations: [{ id: "automations:1" }]
};

describe("activity target navigation", () => {
  it.each([
    ["document", "documents:1", "document"],
    ["presentation", "presentations:1", "presentation"],
    ["spreadsheet", "spreadsheets:1", "spreadsheet"],
    ["research", "researchThreads:1", "research"],
    ["finding", "findings:1", "finding"],
    ["external-file", "externalFiles:1", "file"]
  ] as const)("resolves current %s targets", (targetKind, id, resourceKind) => {
    expect(currentActivityResource(
      { kind: targetKind, id, label: "Historical label" },
      { resources }
    )).toEqual({ id, kind: resourceKind });
  });

  it("does not treat a historical label or id alone as a current destination", () => {
    expect(currentActivityResource(
      { kind: "document", id: "documents:deleted", label: "Still readable" },
      { resources }
    )).toBeUndefined();
    expect(currentActivityResource(
      { kind: "spreadsheet", id: "documents:1", label: "Wrong kind" },
      { resources }
    )).toBeUndefined();
    expect(currentActivityResource(
      { kind: "task", id: "documents:1", label: "Not a resource" },
      { resources }
    )).toBeUndefined();
    expect(currentActivityResource(
      { kind: "document", id: "documents:1", label: "Not loaded" },
      undefined
    )).toBeUndefined();
  });

  it.each([
    ["persona", "personas:1"],
    ["task", "agentTasks:1"],
    ["automation", "automations:1"]
  ] as const)("resolves current %s targets from the Agents index", (kind, id) => {
    expect(currentActivityDestination(
      { kind, id, label: "Historical label" },
      { resources },
      agents
    )).toEqual({ kind, id });
  });

  it("does not link missing Agents targets", () => {
    expect(currentActivityDestination(
      { kind: "task", id: "agentTasks:deleted", label: "Old task" },
      { resources },
      agents
    )).toBeUndefined();
  });

  it("classifies current lookups separately from explicit placeholder links", () => {
    expect(activityDestinationSource("document")).toBe("resources");
    expect(activityDestinationSource("external-file")).toBe("resources");
    expect(activityDestinationSource("task")).toBe("agents");
    expect(activityDestinationSource("connector")).toBe("placeholder");
    expect(activityDestinationSource("comment")).toBeUndefined();
  });

  it("maps current resources to the editor or stable library that owns them", () => {
    expect(openingForActivityDestination(resources[0]!)).toEqual({
      category: "document-editor",
      resourceId: "documents:1"
    });
    expect(openingForActivityDestination(resources[1]!)).toEqual({
      category: "presentation-editor",
      resourceId: "presentations:1"
    });
    expect(openingForActivityDestination(resources[2]!)).toEqual({
      category: "spreadsheet-editor",
      resourceId: "spreadsheets:1"
    });
    expect(openingForActivityDestination(resources[3]!)).toEqual({
      category: "research",
      resourceId: "researchThreads:1",
      content: "research.thread"
    });
    expect(openingForActivityDestination(resources[4]!)).toBeUndefined();
    expect(openingForActivityDestination(resources[5]!)).toEqual({
      category: "external",
      focus: "externalFiles:1"
    });
  });

  it.each([
    ["persona", "personas:1", "agents.persona"],
    ["task", "agentTasks:1", "agents.task"],
    ["automation", "automations:1", "agents.automation"]
  ] as const)("opens %s targets on their exact Agents detail", (kind, id, content) => {
    expect(openingForActivityDestination({ kind, id })).toEqual({
      category: "agents",
      content,
      focus: id
    });
  });
});
