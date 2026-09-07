import { describe, expect, it } from "vitest";

import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import { resolveResourceSet } from "$representation/data/behavior/core/resource-set";

const catalogue: ResourceRef[] = [
  { kind: "document", id: "documents:1" },
  { kind: "document", id: "documents:2" },
  { kind: "slides", id: "slideDecks:1" },
  { kind: "finding", id: "findings:1" },
  { kind: "externalFile::pdf", id: "externalFiles:1" }
];

const ids = (refs: readonly ResourceRef[]) => refs.map((ref) => ref.id);

describe("resolveResourceSet", () => {
  it("selects the whole project, minus what is excluded", () => {
    const set: ResourceSet = { include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] };
    expect(ids(resolveResourceSet(set, catalogue))).toEqual(["documents:1", "documents:2", "findings:1", "externalFiles:1"]);
  });

  it("matches kinds by segment and named resources only when they exist", () => {
    const set: ResourceSet = {
      include: [
        { select: "kinds", kinds: ["externalFile"] },
        { select: "resources", refs: [{ kind: "document", id: "documents:2" }, { kind: "document", id: "documents:9" }] }
      ],
      exclude: []
    };
    expect(ids(resolveResourceSet(set, catalogue))).toEqual(["externalFiles:1", "documents:2"]);
  });

  it("follows a named set and stops at a cycle", () => {
    const sets = new Map<string, ResourceSet>([
      ["resourceSets:1", { include: [{ select: "kinds", kinds: ["finding"] }, { select: "set", setId: "resourceSets:2" as never }], exclude: [] }],
      ["resourceSets:2", { include: [{ select: "set", setId: "resourceSets:1" as never }, { select: "kinds", kinds: ["slides"] }], exclude: [] }]
    ]);
    const set: ResourceSet = { include: [{ select: "set", setId: "resourceSets:1" as never }], exclude: [] };
    expect(ids(resolveResourceSet(set, catalogue, sets))).toEqual(["findings:1", "slideDecks:1"]);
  });

  it("selects nothing from an empty include", () => {
    expect(resolveResourceSet({ include: [], exclude: [] }, catalogue)).toEqual([]);
  });
});
