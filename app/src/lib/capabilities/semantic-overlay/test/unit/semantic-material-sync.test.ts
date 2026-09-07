import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { defineStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentBody } from "$representation/data/types/documents/body";
import { syncSemanticMaterialsFor } from "$capabilities/semantic-overlay/api/shared/material-sync";

const projectId = "projects:materials" as Id<"projects">;
const documentId = "documents:brand" as Id<"documents">;
const fileId = "externalFiles:logo" as Id<"externalFiles">;

const body = (images: number, sourceFileId: Id<"externalFiles"> = fileId): DocumentBody => ({
  rows: [{
    id: "row",
    kind: "blocks",
    blocks: Array.from({ length: images }, (_, index) => ({
      id: `logo-${index + 1}`,
      type: "image" as const,
      source: { kind: "file" as const, fileId: sourceFileId },
      alt: index === 0 ? "Company mark" : "Footer mark"
    }))
  }]
});

const fixture = (
  changeDuringEmbedding = false,
  nativeImage: "missing" | "available" | "failure" = "missing"
) => {
  let now = 1;
  let embeddingCalls = 0;
  let imageEmbeddingCalls = 0;
  let nativeReads = 0;
  let descriptorCalls = 0;
  let descriptorsEnabled = false;
  let descriptorModel = "descriptor-v1";
  const store = defineStore({ now: () => now++ });
  store.create("documents", {
    projectId,
    title: "Brand guide",
    createdBy: { kind: "system" },
    updatedBy: { kind: "system" },
    updatedAt: 1
  });
  const originalBody = body(2);
  const snapshotId = store.create("documentSnapshots", {
    projectId,
    resourceId: documentId,
    revision: 1,
    role: "leader",
    part: 0,
    body: originalBody,
    at: 1
  });
  // Store IDs are opaque, so make the document row addressable by the ref used
  // in the snapshot through a second explicitly linked resource.
  const documents = store.read("documents") as unknown as { rows: Array<{ _id: string }> };
  const createdDocumentId = documents.rows[0]._id;
  store.update(`documentSnapshots.${snapshotId}.resourceId`, createdDocumentId);
  const createdFileId = store.create("externalFiles", {
    projectId,
    name: "logo.png",
    mediaType: "image/png",
    subkind: "image",
    size: 128,
    storageId: "_storage:logo",
    hash: "a".repeat(64),
    origin: { kind: "upload" },
    createdBy: { kind: "system" },
    updatedAt: 1
  });
  const rewired = body(2, createdFileId);
  store.update(`documentSnapshots.${snapshotId}.body`, rewired);
  const ref = { kind: "document", id: createdDocumentId };
  const usage = (operation: string, inputItems = 1) => ({
    operation,
    api: "deterministic-test",
    model: "material-v1",
    requestCount: 1,
    inputItems
  });
  const model = {
    store,
    configuration: {
      get: (key: string): unknown => ({
        "semanticOverlay.materials.generateDescriptors": descriptorsEnabled,
        "intelligence.providers.openrouter.model": descriptorModel,
        "semanticOverlay.index.branchFactor": 3,
        "semanticOverlay.index.leafSize": 2,
        "semanticOverlay.index.maxIterations": 16,
        "semanticOverlay.index.convergenceTolerance": 0.000001,
        "semanticOverlay.index.candidateMultiplier": 2
      })[key]
    },
    embedding: {
      space: { provider: "jina", model: "material-v1", dimensions: 2 },
      passages: async (values: readonly string[]) => {
        embeddingCalls += 1;
        if (changeDuringEmbedding && embeddingCalls === 1) {
          store.update(`documentSnapshots.${snapshotId}.revision`, 2);
          store.update(`documentSnapshots.${snapshotId}.body`, body(0));
        }
        return {
          value: values.map((_, index) => [1, index / 100 + 0.01]),
          usage: usage("passageVectors", values.length)
        };
      },
      image: async () => {
        imageEmbeddingCalls += 1;
        if (nativeImage === "failure") throw new Error("visual provider unavailable");
        return { value: [1, 0], usage: usage("imageVector") };
      }
    },
    intelligence: {
      completeWithTools: async () => {
        descriptorCalls += 1;
        return {
          value: {
            summary: "A company logo used in the brand guide.",
            purpose: "Identify brand assets",
            entities: ["company"],
            measures: [],
            dimensions: [],
            timeRange: "",
            themes: ["brand"],
            uncertainty: []
          },
          usage: { requestCount: 1, promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          toolCalls: [],
          rounds: 1
        };
      }
    },
    materialContent: {
      read: async () => {
        nativeReads += 1;
        return nativeImage === "missing" ? undefined : new Uint8Array([137, 80, 78, 71]);
      }
    },
    observability: { logger: { info: () => {}, warn: () => {} } }
  } as unknown as ServerModel;
  return {
    model,
    store,
    snapshotId,
    ref,
    fileId: createdFileId,
    get embeddingCalls() { return embeddingCalls; },
    get imageEmbeddingCalls() { return imageEmbeddingCalls; },
    get nativeReads() { return nativeReads; },
    get descriptorCalls() { return descriptorCalls; },
    enableDescriptors() { descriptorsEnabled = true; },
    setDescriptorModel(value: string) { descriptorModel = value; }
  };
};

describe("semantic material synchronization", () => {
  it("publishes one content-addressed image with every placement and then becomes a no-op", async () => {
    const held = fixture();
    const first = await syncSemanticMaterialsFor(held.model, projectId, held.ref);

    assert.equal(first.outcome, "published");
    const materials = held.store.read("semanticMaterials") as unknown as {
      rows: Array<{ _id: string; profile: { kind: string; placementCount: number } }>;
    };
    const placements = held.store.read("semanticMaterialPlacements") as unknown as {
      rows: Array<{ semanticMaterialId: string; locator: { blockPath: string[] } }>;
    };
    assert.equal(materials.rows.length, 1);
    assert.equal(materials.rows[0].profile.kind, "image");
    assert.equal(materials.rows[0].profile.placementCount, 2);
    assert.deepEqual(placements.rows.map((placement) => placement.locator.blockPath), [["logo-1"], ["logo-2"]]);
    assert.equal(placements.rows.every((placement) => placement.semanticMaterialId === materials.rows[0]._id), true);
    const facets = (held.store.read("semanticObjects") as unknown as {
      rows: Array<{ facet: string; facetText?: string; scopeRefs?: Array<{ kind: string; id: string }> }>;
    }).rows;
    const authored = facets.find((facet) => facet.facet === "authored");
    assert.deepEqual(authored?.scopeRefs, [held.ref]);
    assert.equal(
      facets.find((facet) => facet.facet === "profile")?.facetText,
      "image. image/png"
    );

    const calls = held.embeddingCalls;
    const second = await syncSemanticMaterialsFor(held.model, projectId, held.ref);
    assert.equal(second.outcome, "current");
    assert.equal(held.embeddingCalls, calls);
  });

  it("discards prepared vectors when the authoritative resource changes before publication", async () => {
    const held = fixture(true);
    const result = await syncSemanticMaterialsFor(held.model, projectId, held.ref);

    assert.equal(result.outcome, "superseded");
    assert.deepEqual((held.store.read("semanticMaterials") as unknown as { rows: unknown[] }).rows, []);
    assert.deepEqual((held.store.read("semanticObjects") as unknown as { rows: unknown[] }).rows, []);
    assert.deepEqual((held.store.read("semanticIndexes") as unknown as { rows: unknown[] }).rows, []);
  });

  it("reuses facets when only placement revisions advance", async () => {
    const held = fixture(false, "available");
    await syncSemanticMaterialsFor(held.model, projectId, held.ref);
    const beforeObjects = (held.store.read("semanticObjects") as unknown as {
      rows: Array<{ _id: string }>;
    }).rows.map((row) => row._id);
    const passageCalls = held.embeddingCalls;
    const imageCalls = held.imageEmbeddingCalls;
    const nativeReads = held.nativeReads;

    held.store.update(`documentSnapshots.${held.snapshotId}.revision`, 2);
    const result = await syncSemanticMaterialsFor(held.model, projectId, held.ref);

    assert.equal(result.outcome, "published");
    assert.equal(held.embeddingCalls, passageCalls);
    assert.equal(held.imageEmbeddingCalls, imageCalls);
    assert.equal(held.nativeReads, nativeReads);
    assert.deepEqual(
      (held.store.read("semanticObjects") as unknown as { rows: Array<{ _id: string }> }).rows.map((row) => row._id),
      beforeObjects
    );
    assert.equal(
      (held.store.read("semanticMaterialPlacements") as unknown as { rows: Array<{ revision: number }> }).rows
        .every((placement) => placement.revision === 2),
      true
    );
  });

  it("retains searchable text facets when native image embedding fails", async () => {
    const held = fixture(false, "failure");
    const result = await syncSemanticMaterialsFor(held.model, projectId, held.ref);

    assert.equal(result.outcome, "published");
    assert.equal(held.imageEmbeddingCalls, 1);
    const material = (held.store.read("semanticMaterials") as unknown as {
      rows: Array<{ state: string; error?: string }>;
    }).rows[0];
    assert.equal(material.state, "ready");
    assert.match(material.error ?? "", /visual provider unavailable/);
    const facets = (held.store.read("semanticObjects") as unknown as {
      rows: Array<{ facet: string }>;
    }).rows.map((row) => row.facet);
    assert.ok(facets.includes("identity"));
    assert.ok(facets.includes("profile"));
    assert.equal(facets.includes("nativeVisual"), false);
  });

  it("deduplicates a shared asset across resources while scoping aggregate context", async () => {
    const held = fixture(false, "available");
    await syncSemanticMaterialsFor(held.model, projectId, held.ref);
    const secondId = held.store.create("documents", {
      projectId,
      title: "Campaign plan",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 2
    });
    held.store.create("documentSnapshots", {
      projectId,
      resourceId: secondId,
      revision: 1,
      role: "leader",
      part: 0,
      body: body(1, held.fileId),
      at: 2
    });
    const secondRef = { kind: "document" as const, id: secondId };

    const result = await syncSemanticMaterialsFor(held.model, projectId, secondRef);

    assert.equal(result.outcome, "published");
    const materials = (held.store.read("semanticMaterials") as unknown as { rows: unknown[] }).rows;
    const placements = (held.store.read("semanticMaterialPlacements") as unknown as { rows: unknown[] }).rows;
    assert.equal(materials.length, 1);
    assert.equal(placements.length, 3);
    const facets = (held.store.read("semanticObjects") as unknown as {
      rows: Array<{ facet: string; scopeRefs?: Array<{ kind: string; id: string }> }>;
    }).rows;
    assert.deepEqual(
      facets.find((facet) => facet.facet === "authored")?.scopeRefs,
      [held.ref, secondRef].sort((left, right) => String(left.id).localeCompare(String(right.id)))
    );
    assert.equal(facets.find((facet) => facet.facet === "identity")?.scopeRefs, undefined);
    assert.equal(facets.find((facet) => facet.facet === "profile")?.scopeRefs, undefined);
    assert.equal(facets.find((facet) => facet.facet === "nativeVisual")?.scopeRefs, undefined);
  });

  it("refreshes generated descriptors when policy or model identity changes", async () => {
    const held = fixture(false, "available");
    await syncSemanticMaterialsFor(held.model, projectId, held.ref);
    assert.equal(held.descriptorCalls, 0);

    held.enableDescriptors();
    const enabled = await syncSemanticMaterialsFor(held.model, projectId, held.ref);
    assert.equal(enabled.outcome, "published");
    assert.equal(held.descriptorCalls, 1);
    const described = (held.store.read("semanticMaterials") as unknown as {
      rows: Array<{ descriptor?: { model: string } }>;
    }).rows[0];
    assert.equal(described.descriptor?.model, "descriptor-v1");
    assert.equal(
      (held.store.read("semanticObjects") as unknown as { rows: Array<{ facet: string }> }).rows
        .some((row) => row.facet === "generated"),
      true
    );

    const current = await syncSemanticMaterialsFor(held.model, projectId, held.ref);
    assert.equal(current.outcome, "current");
    assert.equal(held.descriptorCalls, 1);

    held.setDescriptorModel("descriptor-v2");
    const migrated = await syncSemanticMaterialsFor(held.model, projectId, held.ref);
    assert.equal(migrated.outcome, "published");
    assert.equal(held.descriptorCalls, 2);
    assert.equal(
      (held.store.read("semanticMaterials") as unknown as {
        rows: Array<{ descriptor?: { model: string } }>;
      }).rows[0].descriptor?.model,
      "descriptor-v2"
    );
  });

  it("keeps a shared uploaded image after its last resource placement is removed", async () => {
    const held = fixture();
    await syncSemanticMaterialsFor(held.model, projectId, held.ref);
    held.store.update(`documentSnapshots.${held.snapshotId}.revision`, 2);
    held.store.update(`documentSnapshots.${held.snapshotId}.body`, { rows: [] });

    const result = await syncSemanticMaterialsFor(held.model, projectId, held.ref);

    assert.equal(result.outcome, "published");
    const materials = (held.store.read("semanticMaterials") as unknown as {
      rows: Array<{
        source: { kind: string; ref: { kind: string } };
        profile: { kind: string; placementCount: number };
      }>;
    }).rows;
    assert.equal(materials.length, 1);
    assert.equal(materials[0].source.kind, "externalFile");
    assert.equal(materials[0].source.ref.kind, "externalFile::image");
    assert.equal(materials[0].profile.kind, "image");
    assert.equal(materials[0].profile.placementCount, 0);
    assert.equal(
      (held.store.read("semanticMaterialPlacements") as unknown as { rows: unknown[] }).rows.length,
      0
    );
  });
});
