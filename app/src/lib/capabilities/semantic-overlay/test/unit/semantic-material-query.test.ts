import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const state = vi.hoisted(() => {
  const tables = new Map<string, Row[]>();
  let queries = 0;
  const model = {
    store: {
      read(path: string) {
        const [table] = path.split(".");
        return { kind: "table", table, rows: tables.get(table) ?? [] };
      }
    },
    embedding: {
      space: { provider: "jina", model: "material-v1", dimensions: 2 },
      query: async () => {
        queries += 1;
        return {
          value: [1, 0],
          usage: {
            operation: "queryVector",
            api: "deterministic-test",
            model: "material-v1",
            requestCount: 1,
            inputItems: 1
          }
        };
      }
    }
  };
  return {
    tables,
    model,
    get queries() { return queries; },
    resetQueries() { queries = 0; }
  };
});

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:materials", userId: "users:one", username: "You" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => state.model }));

const { querySemanticMaterials } = await import(
  "$capabilities/semantic-overlay/api/query-semantic-materials/query-semantic-materials"
);

const set = (table: string, rows: Row[]): void => {
  state.tables.set(table, rows);
};

beforeEach(() => {
  state.tables.clear();
  state.resetQueries();
  set("semanticOverlays", [{
    _id: "semanticOverlays:one",
    _creationTime: 1,
    projectId: "projects:materials",
    generation: 7,
    embedding: { provider: "jina", model: "material-v1", dimensions: 2 },
    updatedAt: 1
  }]);
  set("documents", [{
    _id: "documents:sales", _creationTime: 1, projectId: "projects:materials",
    title: "Sales", createdBy: { kind: "system" }, updatedBy: { kind: "system" }, updatedAt: 1
  }]);
  set("documentSnapshots", [{
    _id: "documentSnapshots:sales", _creationTime: 1, projectId: "projects:materials",
    resourceId: "documents:sales", revision: 3, role: "leader", part: 0,
    body: { rows: [] }, at: 1
  }]);
  set("presentations", [{
    _id: "presentations:launch", _creationTime: 1, projectId: "projects:materials",
    title: "Launch", createdBy: { kind: "system" }, updatedBy: { kind: "system" }, updatedAt: 1
  }]);
  set("presentationSnapshots", [{
    _id: "presentationSnapshots:launch", _creationTime: 1, projectId: "projects:materials",
    resourceId: "presentations:launch", revision: 2, role: "leader", part: 0,
    body: {
      aspectRatio: "16:9",
      theme: { colors: { text: "#111", accent: "#08f" } },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [],
      slides: [],
      sections: []
    },
    at: 1
  }]);
  set("externalFiles", [{
    _id: "externalFiles:logo", _creationTime: 1, projectId: "projects:materials",
    name: "launch-diagram.png", originalName: "launch-diagram.png",
    relativePath: "launch-diagram.png", mediaType: "image/png", subkind: "image",
    storageId: `_storage:${"a".repeat(64)}`, hash: "a".repeat(64), size: 12,
    origin: { kind: "upload" }, createdBy: { kind: "system" },
    updatedBy: { kind: "system" }, revision: 1, updatedAt: 1
  }]);
  set("semanticMaterials", [
    {
      _id: "semanticMaterials:sales",
      _creationTime: 1,
      projectId: "projects:materials",
      identityKey: "sales",
      kind: "table",
      name: "Regional revenue",
      source: {
        kind: "resourceContent",
        ref: { kind: "document", id: "documents:sales" },
        revision: 3,
        locator: { kind: "documentBlock", area: "body", rowId: "row", blockPath: ["table"] }
      },
      profile: {
        kind: "table",
        rows: 3,
        columns: 2,
        headerRows: 1,
        headers: ["Region", "Revenue"],
        columnsProfile: [],
        mergedRegions: 0,
        sample: [],
        warnings: []
      },
      profileHash: "profile-sales",
      contextHash: "context-sales",
      revisionKey: "revision:document:documents:sales:3",
      descriptor: {
        summary: "Revenue by region for the launch plan.",
        entities: [], measures: ["Revenue"], dimensions: ["Region"], themes: ["launch"], uncertainty: [],
        coverage: { mode: "complete", description: "Complete profile." },
        model: "test", promptVersion: "v1", inputHash: "descriptor-sales", generatedAt: 1
      },
      state: "ready",
      updatedAt: 1
    },
    {
      _id: "semanticMaterials:logo",
      _creationTime: 2,
      projectId: "projects:materials",
      identityKey: "logo",
      kind: "image",
      name: "launch-diagram.png",
      source: {
        kind: "externalFile",
        ref: { kind: "externalFile::image", id: "externalFiles:logo" },
        fileId: "externalFiles:logo",
        hash: "a".repeat(64),
        mediaType: "image/png",
        subkind: "image"
      },
      profile: {
        kind: "image",
        assetHash: "a".repeat(64),
        mediaType: "image/png",
        source: { kind: "file", fileId: "externalFiles:logo" },
        placementCount: 1,
        warnings: []
      },
      profileHash: "profile-logo",
      contextHash: "context-logo",
      revisionKey: `hash:${"a".repeat(64)}`,
      state: "ready",
      updatedAt: 1
    }
  ]);
  set("semanticMaterialPlacements", [
    {
      _id: "semanticMaterialPlacements:sales",
      _creationTime: 1,
      projectId: "projects:materials",
      semanticMaterialId: "semanticMaterials:sales",
      ref: { kind: "document", id: "documents:sales" },
      revision: 3,
      locator: { kind: "documentBlock", area: "body", rowId: "row", blockPath: ["table"] },
      context: { nearbyText: [], notes: [] },
      contextHash: "context-sales",
      updatedAt: 1
    },
    {
      _id: "semanticMaterialPlacements:logo",
      _creationTime: 2,
      projectId: "projects:materials",
      semanticMaterialId: "semanticMaterials:logo",
      ref: { kind: "presentation", id: "presentations:launch" },
      revision: 2,
      locator: { kind: "slideElement", slideId: "slide-1", elementPath: ["image"] },
      context: { nearbyText: ["Launch system"], notes: [] },
      contextHash: "context-logo",
      updatedAt: 1
    }
  ]);
  set("resourceSets", [{
    _id: "resourceSets:launch-only",
    _creationTime: 1,
    projectId: "projects:materials",
    name: "Launch presentation only",
    set: {
      include: [{ select: "resources", refs: [{ kind: "presentation", id: "presentations:launch" }] }],
      exclude: []
    },
    createdBy: { kind: "system" },
    revision: 1,
    updatedAt: 1
  }]);
  set("semanticObjects", [
    {
      _id: "semanticObjects:sales-profile",
      _creationTime: 1,
      projectId: "projects:materials",
      lane: "material",
      semanticMaterialId: "semanticMaterials:sales",
      facet: "profile",
      facetText: "Regional revenue. 3 rows. Headers Region, Revenue.",
      inputHash: "sales-profile",
      vector: [1, 0]
    },
    {
      _id: "semanticObjects:sales-generated",
      _creationTime: 2,
      projectId: "projects:materials",
      lane: "material",
      semanticMaterialId: "semanticMaterials:sales",
      facet: "generated",
      facetText: "Revenue by region for the launch plan.",
      inputHash: "sales-generated",
      scopeRefs: [],
      vector: [0.99, 0.01]
    },
    {
      _id: "semanticObjects:logo",
      _creationTime: 3,
      projectId: "projects:materials",
      lane: "material",
      semanticMaterialId: "semanticMaterials:logo",
      facet: "nativeVisual",
      inputHash: "logo-visual",
      vector: [0.98, 0.02]
    },
    {
      _id: "semanticObjects:logo-profile",
      _creationTime: 4,
      projectId: "projects:materials",
      lane: "material",
      semanticMaterialId: "semanticMaterials:logo",
      facet: "profile",
      facetText: "image. image/png",
      inputHash: "logo-profile",
      vector: [0, 1]
    },
    {
      _id: "semanticObjects:logo-authored",
      _creationTime: 5,
      projectId: "projects:materials",
      lane: "material",
      semanticMaterialId: "semanticMaterials:logo",
      facet: "authored",
      facetText: "Secret campaign context from another resource.",
      inputHash: "logo-authored",
      scopeRefs: [
        { kind: "document", id: "documents:sales" },
        { kind: "presentation", id: "presentations:launch" }
      ],
      vector: [0.97, 0.03]
    },
    {
      _id: "semanticObjects:text-lane",
      _creationTime: 6,
      projectId: "projects:materials",
      lane: "text",
      semanticSourceId: "semanticSources:text",
      span: { from: 0, to: 4, text: "text" },
      vector: [1, 0]
    }
  ]);
  set("semanticIndexes", [{
    _id: "semanticIndexes:materials",
    _creationTime: 1,
    projectId: "projects:materials",
    semanticOverlayId: "semanticOverlays:one",
    method: "recursiveClustering",
    lane: "material",
    rootNodeIds: ["semanticIndexNodes:root"],
    configuration: {
      branchFactor: 3,
      leafSize: 4,
      maxIterations: 10,
      convergenceTolerance: 0.000001,
      candidateMultiplier: 3
    },
    updatedAt: 1
  }]);
  set("semanticIndexNodes", [{
    _id: "semanticIndexNodes:root",
    _creationTime: 1,
    projectId: "projects:materials",
    indexId: "semanticIndexes:materials",
    centroidVector: [1, 0],
    children: {
      kind: "objects",
      ids: [
        "semanticObjects:sales-profile",
        "semanticObjects:sales-generated",
        "semanticObjects:logo",
        "semanticObjects:logo-profile",
        "semanticObjects:logo-authored"
      ]
    }
  }]);
});

describe("semantic material query", () => {
  it("keeps the material lane isolated and groups matching facets by native material", async () => {
    const result = await querySemanticMaterials({ text: "launch revenue", topK: 3 });

    assert.equal(result.overlayGeneration, 7);
    assert.equal(result.hits.length, 2);
    assert.equal(result.hits[0].material.materialId, "semanticMaterials:sales");
    assert.deepEqual(result.hits[0].matchedFacets, ["profile", "generated"]);
    assert.equal(result.hits[0].description?.provenance, "generated");
    assert.equal(result.hits.flatMap((hit) => hit.semanticObjectIds).some((id) => id === "semanticObjects:text-lane"), false);
    assert.equal(state.queries, 1);
  });

  it("overfetches facets so topK counts distinct materials rather than facet rows", async () => {
    const result = await querySemanticMaterials({ text: "launch revenue", topK: 2 });

    assert.deepEqual(
      result.hits.map((hit) => hit.material.materialId),
      ["semanticMaterials:sales", "semanticMaterials:logo"]
    );
  });

  it("uses named Resource Set placement scope without leaking aggregate context", async () => {
    const result = await querySemanticMaterials({
      text: "launch image",
      kinds: ["image"],
      topK: 4,
      scope: {
        include: [{ select: "set", setId: "resourceSets:launch-only" }],
        exclude: []
      }
    });

    assert.deepEqual(result.hits.map((hit) => hit.material.materialId), ["semanticMaterials:logo"]);
    assert.deepEqual(result.hits[0].material.placement?.ref, { kind: "presentation", id: "presentations:launch" });
    assert.equal(result.hits[0].matchedFacets.includes("authored"), false);
    assert.equal(
      result.hits[0].matched.some((match) => match.text?.includes("Secret campaign") === true),
      false
    );
  });

  it("does not resolve an unnamed private Resource Set supplied as query scope", async () => {
    set("resourceSets", [
      ...((state.tables.get("resourceSets") ?? []) as Row[]),
      {
        _id: "resourceSets:private",
        _creationTime: 2,
        projectId: "projects:materials",
        boundTo: {
          kind: "resource",
          ref: { kind: "presentation", id: "presentations:launch" },
          hole: "evidence"
        },
        set: {
          include: [
            { select: "resources", refs: [{ kind: "presentation", id: "presentations:launch" }] }
          ],
          exclude: []
        },
        createdBy: { kind: "system" },
        revision: 1,
        updatedAt: 1
      }
    ]);

    await assert.rejects(
      () => querySemanticMaterials({
        text: "launch image",
        kinds: ["image"],
        topK: 4,
        scope: {
          include: [{ select: "set", setId: "resourceSets:private" }],
          exclude: []
        }
      }),
      /does not exist/
    );
    assert.equal(state.queries, 0);
  });

  it("fails closed on duplicate and malformed named Resource Sets before material search", async () => {
    const reusable = (state.tables.get("resourceSets") ?? [])[0];
    if (reusable === undefined) throw new Error("missing reusable Resource Set fixture");
    const query = () => querySemanticMaterials({
      text: "launch image",
      kinds: ["image"],
      topK: 4,
      scope: {
        include: [{ select: "set", setId: "resourceSets:launch-only" }],
        exclude: []
      }
    });

    set("resourceSets", [
      reusable,
      { ...reusable, projectId: "projects:other", name: "Duplicate claimant" }
    ]);
    await assert.rejects(query, /repeats row id/);

    set("resourceSets", [
      { ...reusable, set: { include: "everything", exclude: [] } }
    ]);
    await assert.rejects(query, /non-current field values/);
    assert.equal(state.queries, 0);
  });

  it("makes aggregate context eligible when every contributing resource is in scope", async () => {
    const result = await querySemanticMaterials({
      text: "secret campaign",
      kinds: ["image"],
      topK: 4,
      scope: {
        include: [{
          select: "resources",
          refs: [
            { kind: "document", id: "documents:sales" },
            { kind: "presentation", id: "presentations:launch" }
          ]
        }],
        exclude: []
      }
    });
    const logo = result.hits.find((hit) => hit.material.materialId === "semanticMaterials:logo");

    assert.ok(logo);
    assert.equal(logo.matchedFacets.includes("authored"), true);
    assert.equal(logo.matched.some((match) => match.text?.includes("Secret campaign") === true), true);
  });

  it("does not call the embedding provider when scope leaves no eligible material", async () => {
    const result = await querySemanticMaterials({
      text: "anything",
      topK: 2,
      scope: { include: [], exclude: [{ select: "project" }] }
    });
    assert.deepEqual(result.hits, []);
    assert.deepEqual(result.usage, []);
    assert.equal(state.queries, 0);
  });

  it("stops serving a resource material immediately when its leader revision advances", async () => {
    (state.tables.get("documentSnapshots") ?? [])[0].revision = 4;
    const result = await querySemanticMaterials({
      text: "regional revenue",
      topK: 2,
      scope: {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:sales" }] }],
        exclude: []
      }
    });

    assert.deepEqual(result.hits, []);
    assert.deepEqual(result.usage, []);
    assert.equal(state.queries, 0);
  });
});
