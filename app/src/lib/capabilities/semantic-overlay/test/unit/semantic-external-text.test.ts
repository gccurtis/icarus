import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { defineStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import { semanticSourceIsCurrent } from "$capabilities/semantic-overlay/api/shared/freshness";
import { readMaterialInventoryFor } from "$capabilities/semantic-overlay/api/shared/material-resource";
import { readSemanticResourceForModel } from "$capabilities/semantic-overlay/api/shared/resource";
import { syncSemanticResourceFor } from "$capabilities/semantic-overlay/api/shared/sync";

const projectId = "projects:external-text" as Id<"projects">;

const fixture = () => {
  let now = 1;
  let tokenCalls = 0;
  let nativeReads = 0;
  const store = defineStore({ now: () => now++ });
  const firstHash = "a".repeat(64);
  const secondHash = "b".repeat(64);
  const bodies = new Map([
    [firstHash, new TextEncoder().encode("Gary is twenty-seven.")],
    [secondHash, new TextEncoder().encode("Gary is forty-three.")]
  ]);
  const fileFields = {
    projectId,
    name: "facts.md",
    originalName: "facts.md",
    relativePath: "facts.md",
    mediaType: "text/markdown",
    subkind: "text" as const,
    storageId: `_storage:${firstHash}`,
    hash: firstHash,
    size: 21,
    origin: { kind: "upload" as const },
    createdBy: { kind: "system" as const },
    updatedBy: { kind: "system" as const },
    revision: 1,
    updatedAt: 1
  };
  const fileId = store.create("externalFiles", fileFields);
  const usage = (operation: string, inputItems = 1) => ({
    operation,
    api: "deterministic-test",
    model: "external-text-v1",
    requestCount: 1,
    inputItems
  });
  const model = {
    store,
    configuration: {
      get: (key: string): unknown => ({
        "semanticOverlay.translation.maxTokens": 320,
        "semanticOverlay.translation.minTokens": 1,
        "semanticOverlay.translation.changeThreshold": 0.28,
        "semanticOverlay.translation.basinProminenceThreshold": 0,
        "semanticOverlay.translation.basinMassFraction": 0,
        "semanticOverlay.translation.attractionDecayTokens": 2,
        "semanticOverlay.translation.attractionStationaryThreshold": 0.005,
        "semanticOverlay.index.branchFactor": 3,
        "semanticOverlay.index.leafSize": 2,
        "semanticOverlay.index.maxIterations": 16,
        "semanticOverlay.index.convergenceTolerance": 0.000001,
        "semanticOverlay.index.candidateMultiplier": 2
      })[key]
    },
    embedding: {
      space: { provider: "jina", model: "external-text-v1", dimensions: 2 },
      tokenField: async (value: string) => {
        tokenCalls += 1;
        return {
          value: {
            labels: ["Pass", "age", ":", value],
            vectors: [[0, 0], [0, 0], [0, 0], [1, 0]]
          },
          usage: usage("tokenField")
        };
      },
      windowedPassages: async (values: readonly string[]) => ({
        value: values.map(() => [1, 0]),
        usage: usage("windowedPassageVectors", values.length)
      })
    },
    externalFileStorage: {
      read: async ({ hash }: { hash: string }) => {
        nativeReads += 1;
        return bodies.get(hash);
      }
    },
    observability: { logger: { info: () => {}, warn: () => {} } }
  } as unknown as ServerModel;
  return {
    model,
    store,
    fileId,
    fileFields,
    firstHash,
    secondHash,
    get tokenCalls() { return tokenCalls; },
    get nativeReads() { return nativeReads; }
  };
};

describe("external exact-text synchronization", () => {
  it("publishes UTF-8 text by exact revision and hash, reuses it, and replaces it", async () => {
    const held = fixture();
    const ref: ResourceRef = { kind: "externalFile::text", id: held.fileId };

    const first = await syncSemanticResourceFor(held.model, projectId, ref);
    assert.equal(first.outcome, "published");
    const firstSource = (held.store.read("semanticSources") as unknown as {
      rows: Array<{ contentHash?: string; revision: number }>;
    }).rows[0];
    assert.equal(firstSource.revision, 1);
    assert.equal(firstSource.contentHash, held.firstHash);
    assert.equal(semanticSourceIsCurrent(held.store, projectId, firstSource as never), true);
    assert.equal(
      (held.store.read("semanticObjects") as unknown as {
        rows: Array<{ span: { text: string } }>;
      }).rows[0].span.text,
      "Gary is twenty-seven."
    );

    const calls = held.tokenCalls;
    assert.equal((await syncSemanticResourceFor(held.model, projectId, ref)).outcome, "current");
    assert.equal(held.tokenCalls, calls);

    held.store.update(`externalFiles.${held.fileId}`, {
      ...held.fileFields,
      storageId: `_storage:${held.secondHash}`,
      hash: held.secondHash,
      size: 20,
      revision: 2,
      updatedAt: 2
    });
    assert.equal(semanticSourceIsCurrent(held.store, projectId, firstSource as never), false);
    const second = await syncSemanticResourceFor(held.model, projectId, ref);
    assert.equal(second.outcome, "published");
    const active = (held.store.read("semanticSources") as unknown as {
      rows: Array<{ contentHash?: string; revision: number }>;
    }).rows;
    assert.equal(active.length, 1);
    assert.equal(active[0].revision, 2);
    assert.equal(active[0].contentHash, held.secondHash);
    assert.equal(
      (held.store.read("semanticObjects") as unknown as {
        rows: Array<{ span: { text: string } }>;
      }).rows[0].span.text,
      "Gary is forty-three."
    );
    const history = (held.store.read("semanticObjectHistory") as unknown as {
      rows: Array<{ object: { source?: { contentHash?: string } } }>;
    }).rows;
    assert.equal(history[0].object.source?.contentHash, held.firstHash);
  });

  it("uses only the exact-text lane and rejects a mismatched concrete subkind", async () => {
    const held = fixture();
    const ref: ResourceRef = { kind: "externalFile::text", id: held.fileId };

    const inventory = await readMaterialInventoryFor(held.model, projectId, ref);
    assert.deepEqual(inventory?.seeds, []);
    assert.equal(held.nativeReads, 0, "the material lane does not read prose bytes");

    const exact = await readSemanticResourceForModel(held.model, projectId, ref);
    assert.deepEqual(exact, {
      ref,
      revision: 1,
      contentHash: held.firstHash,
      text: "Gary is twenty-seven.",
      encoding: "utf-16",
      locators: [{ from: 0, to: 21, locator: { kind: "externalFileContent" } }],
      hardBoundaries: []
    });
    assert.equal(held.nativeReads, 1);

    const wrongRef: ResourceRef = { kind: "externalFile::data", id: held.fileId };
    assert.equal(await readSemanticResourceForModel(held.model, projectId, wrongRef), undefined);
    assert.equal(await readMaterialInventoryFor(held.model, projectId, wrongRef), undefined);
    assert.equal(held.nativeReads, 1, "a mismatched nominal ref never reaches native storage");
  });

  it("rejects a lane-less semantic object at Store admission", async () => {
    const held = fixture();
    const ref: ResourceRef = { kind: "externalFile::text", id: held.fileId };
    const first = await syncSemanticResourceFor(held.model, projectId, ref);
    assert.equal(first.outcome, "published");
    const source = (held.store.read("semanticSources") as unknown as {
      rows: Array<{ _id: string }>;
    }).rows[0];
    assert.throws(
      () => held.store.create("semanticObjects", {
        projectId,
        semanticSourceId: source._id,
        span: { from: 0, to: 4, text: "old?" },
        vector: [1, 0]
      } as never),
      /missing required field: lane/
    );
    assert.equal(
      (held.store.read("semanticObjects") as unknown as { rows: unknown[] }).rows.length,
      1
    );
  });
});
