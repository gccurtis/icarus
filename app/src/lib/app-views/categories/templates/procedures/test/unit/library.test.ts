import { describe, expect, it } from "vitest";
import { asId } from "$representation/data/behavior/core/id";
import type { ProjectResourceIndex } from "$capabilities/project-resources/index.remote";

import {
  answersFrom,
  emptyTemplateInspectorTitle,
  ruleOf,
  resourcesIn,
  scopeNamesOf,
  selectedTemplateIdIn,
  templateDetail
} from "$app-views/categories/templates/procedures/library.svelte";

const externalIndex: ProjectResourceIndex = {
  resources: [{
    id: "externalFiles:source",
    ref: { kind: "externalFile::code", id: asId<"externalFiles">("externalFiles:source") },
    kind: "file",
    name: "source.ts",
    relativePath: "sources/source.ts",
    updatedAt: 1,
    updatedByName: "Icarus"
  }],
  unavailable: []
};

describe("template library view procedures", () => {
  it("reads a default in the shared words and sends an answer as the rule it is", () => {
    const rule = { include: [{ select: "set" as const, setId: "resourceSets:1" as never }], exclude: [] };
    const sets = [
      { id: "resourceSets:1", name: "Winter filings", set: { include: [], exclude: [] }, createdByName: "Uma", revision: 1, updatedAt: 1, resolves: 2 }
    ];
    expect(ruleOf(rule, scopeNamesOf(sets, []))).toBe("Winter filings");
    expect(ruleOf(rule)).toBe("A chosen group");
    expect(answersFrom({ evidence: undefined })).toEqual({});
    expect(
      answersFrom({ evidence: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } })
    ).toEqual({ evidence: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } });
  });

  it("does not issue a detail read when no template is selected", () => {
    expect(templateDetail(undefined)).toBeUndefined();
  });

  it("does not send stale or deleted selections to the detail read", () => {
    expect(selectedTemplateIdIn("tp-cost", [])).toBeUndefined();
    expect(selectedTemplateIdIn("templates:gone", ["templates:1"])).toBeUndefined();
    expect(selectedTemplateIdIn("templates:1", ["templates:1"])).toBe("templates:1");
  });

  it("distinguishes an empty library from an unselected populated library", () => {
    expect(emptyTemplateInspectorTitle(0)).toBe("No templates exist.");
    expect(emptyTemplateInspectorTitle(1)).toBe("Select a template to inspect it.");
    expect(emptyTemplateInspectorTitle(undefined)).toBe("Select a template to inspect it.");
  });

  it("uses the exact represented External ref rather than its file presentation label", () => {
    expect(resourcesIn(externalIndex)).toEqual([{
      kind: "externalFile::code",
      id: "externalFiles:source",
      name: "source.ts",
      relativePath: "sources/source.ts"
    }]);
    expect(() => resourcesIn({
      ...externalIndex,
      resources: [{ ...externalIndex.resources[0], ref: { kind: "file", id: "externalFiles:source" } as never }]
    })).toThrow(/current resource kind/);
  });
});
