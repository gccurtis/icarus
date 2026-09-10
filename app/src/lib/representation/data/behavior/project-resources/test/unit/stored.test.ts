import { describe, expect, it } from "vitest";
import { isStoredFinding } from "$representation/data/behavior/project-resources/stored";

const finding = () => ({
  _id: "findings:1",
  _creationTime: 1,
  projectId: "default",
  title: "Relay opened first",
  body: [],
  sources: [{
    kind: "resource",
    ref: { kind: "document", id: "documents:1" },
    locator: "page 2"
  }],
  evidenceFor: ["hypotheses:1"],
  relatedTo: ["questions:1"],
  researchThreadIds: ["researchThreads:1"],
  createdBy: { kind: "system" },
  updatedBy: { kind: "system" },
  revision: 1,
  updatedAt: 2
});

describe("current finding storage", () => {
  it("admits one complete current finding", () => {
    expect(isStoredFinding(finding())).toBe(true);
  });

  it("rejects unknown fields, partial sources, and duplicate relationships", () => {
    expect(isStoredFinding({ ...finding(), unknownField: true })).toBe(false);
    expect(isStoredFinding({
      ...finding(),
      sources: [{ kind: "resource", ref: { kind: "document" } }]
    })).toBe(false);
    expect(isStoredFinding({
      ...finding(),
      evidenceFor: ["hypotheses:1", "hypotheses:1"]
    })).toBe(false);
  });

  it("does not coerce a source discriminator into a current literal", () => {
    expect(isStoredFinding({
      ...finding(),
      sources: [{ kind: { toString: () => "manual" }, note: "Observed" }]
    })).toBe(false);
  });
});
