import { describe, expect, it } from "vitest";

import {
  currentActivityResource,
  type ActivityResource
} from "$app-views/categories/project-overview/procedures/activity-target";
import { openingFor } from "$app-views/categories/project-overview/procedures/opening";

const resources: readonly ActivityResource[] = [
  { id: "documents:1", kind: "document" },
  { id: "presentations:1", kind: "presentation" },
  { id: "spreadsheets:1", kind: "spreadsheet" },
  { id: "researchThreads:1", kind: "research" },
  { id: "findings:1", kind: "finding" },
  { id: "externalFiles:1", kind: "file" }
];

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

  it("maps current resources to the editor or stable library that owns them", () => {
    expect(openingFor(resources[0]!)).toEqual({
      category: "document-editor",
      resourceId: "documents:1"
    });
    expect(openingFor(resources[1]!)).toEqual({
      category: "presentation-editor",
      resourceId: "presentations:1"
    });
    expect(openingFor(resources[2]!)).toEqual({
      category: "spreadsheet-editor",
      resourceId: "spreadsheets:1"
    });
    expect(openingFor(resources[3]!)).toEqual({
      category: "research",
      resourceId: "researchThreads:1",
      content: "research.thread"
    });
    expect(openingFor(resources[4]!)).toBeUndefined();
    expect(openingFor(resources[5]!)).toEqual({
      category: "external",
      focus: "externalFiles:1"
    });
  });
});
