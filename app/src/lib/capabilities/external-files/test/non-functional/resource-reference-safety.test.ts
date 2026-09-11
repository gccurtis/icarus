import { describe, expect, it } from "vitest";

import { defineStore } from "$model/server/store/index.server";
import { EXTERNAL_REFERENCE_POLICY } from "$representation/data/behavior/external/reference-policy";
import { externalFileUsage } from "$capabilities/external-files/api/shared/usage/usage";
import { populateHistoricalExternalReferences } from "$capabilities/external-files/test/non-functional/historical-reference-fixture";
import {
  externalFileId,
  linkedBlock,
  populateLiveExternalReferences,
  referenceActor,
  referenceScope
} from "$capabilities/external-files/test/non-functional/resource-reference-fixture";

describe("complete External resource-reference deletion policy", () => {
  it("classifies every current represented table explicitly", () => {
    expect(Object.values(EXTERNAL_REFERENCE_POLICY)).toContain("live-traversal");
    expect(Object.values(EXTERNAL_REFERENCE_POLICY)).toContain("historical-by-value");
    expect(Object.values(EXTERNAL_REFERENCE_POLICY)).toContain("derived-cache");
    expect(EXTERNAL_REFERENCE_POLICY.externalFiles).toBe("subject");
  });

  it("finds every current live identity-bearing representation family", () => {
    const store = defineStore({ now: () => 100 });
    populateLiveExternalReferences(store);

    const usage = externalFileUsage(store, referenceScope, externalFileId);
    expect(new Set(usage.items.map((item) => item.kind))).toEqual(new Set([
      "document",
      "presentation",
      "spreadsheet",
      "resource-set",
      "finding",
      "question",
      "hypothesis",
      "comment",
      "research",
      "thread",
      "persona",
      "agent-task",
      "automation",
      "derived-output",
      "variable",
      "formula"
    ]));
    expect(usage.total).toBe(16);
  });

  it("rejects live templates that embed a concrete External identity", () => {
    const store = defineStore({ now: () => 100 });
    expect(() => store.create("templates", {
      projectId: referenceScope.projectId,
      userId: referenceScope.userId,
      name: "Invalid linked template",
      tags: [],
      body: {
        resource: "document",
        rows: [{ id: "row", kind: "blocks", blocks: [linkedBlock("template")] }]
      },
      slots: [],
      createdBy: referenceActor,
      revision: 1,
      updatedAt: 1
    })).toThrow("has non-current field values");
  });

  it("does not block on historical values, semantic caches, or workspace focus", () => {
    const store = defineStore({ now: () => 100 });
    populateHistoricalExternalReferences(store);

    expect(externalFileUsage(store, referenceScope, externalFileId)).toEqual({
      total: 0,
      items: []
    });
  });
});
