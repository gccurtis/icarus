import { describe, expect, it } from "vitest";

import { isStoredSemanticMaterial } from "$representation/data/behavior/semantic/stored-materials";

const material = () => ({
  _id: "semanticMaterials:table",
  _creationTime: 1,
  projectId: "projects:project",
  identityKey: "table:forecast",
  kind: "table",
  name: "Forecast",
  source: {
    kind: "resourceContent",
    ref: { kind: "document", id: "documents:forecast" },
    revision: 2,
    locator: {
      kind: "documentBlock",
      area: "body",
      rowId: "forecast-row",
      blockPath: ["forecast-table"]
    }
  },
  profile: {
    kind: "table",
    rows: 1,
    columns: 1,
    headerRows: 1,
    headers: ["Month"],
    columnsProfile: [],
    mergedRegions: 0,
    sample: [["Month"]],
    warnings: []
  },
  profileHash: "profile-current",
  contextHash: "context-current",
  revisionKey: "revision:document:documents:forecast:2",
  state: "ready",
  updatedAt: 10
});

describe("stored semantic material", () => {
  it("admits the sole usable current material state", () => {
    expect(isStoredSemanticMaterial(material())).toBe(true);
    expect(isStoredSemanticMaterial({
      ...material(),
      error: "Optional visual description was unavailable"
    })).toBe(true);
  });

  it("rejects retired in-row work states and decorated fields", () => {
    expect(isStoredSemanticMaterial({ ...material(), state: "profiled" })).toBe(false);
    expect(isStoredSemanticMaterial({ ...material(), state: "describing" })).toBe(false);
    expect(isStoredSemanticMaterial({ ...material(), state: "stale" })).toBe(false);
    expect(isStoredSemanticMaterial({ ...material(), state: "error" })).toBe(false);
    expect(isStoredSemanticMaterial({ ...material(), error: undefined })).toBe(false);
    expect(isStoredSemanticMaterial({ ...material(), legacyStatus: "ready" })).toBe(false);
  });
});
