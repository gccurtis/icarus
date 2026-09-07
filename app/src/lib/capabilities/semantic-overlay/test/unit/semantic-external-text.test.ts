import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { defineStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { semanticSourceIsCurrent } from "$capabilities/semantic-overlay/api/shared/freshness";
import { syncSemanticResourceFor } from "$capabilities/semantic-overlay/api/shared/sync";

const projectId = "projects:external-text" as Id<"projects">;

const fixture = () => {
  let now = 1;
  let tokenCalls = 0;
  const store = defineStore({ now: () => now++ });
  const firstHash = "a".repeat(64);
  const secondHash = "b".repeat(64);
  const bodies = new Map([
    [firstHash, new TextEncoder().encode("Gary is twenty-seven.")],
    [secondHash, new TextEncoder().encode("Gary is forty-three.")]
  ]);
  const fileId = store.create("externalFiles", {
    projectId,
    name: "facts.md",
    mediaType: "text/markdown",
    subkind: "text",
    storageId: "_storage:facts",
    hash: firstHash,
    origin: { kind: "upload" },
    createdBy: { kind: "system" },
    updatedAt: 1
  });
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
    materialContent: {
      read: async ({ hash }: { hash: string }) => bodies.get(hash)
    },
    observability: { logger: { info: () => {}, warn: () => {} } }
  } as unknown as ServerModel;
  return {
    model,
    store,
    fileId,
    firstHash,
    secondHash,
    get tokenCalls() { return tokenCalls; }
  };
};

describe("external exact-text synchronization", () => {
  it("publishes UTF-8 text by immutable hash, reuses it, and replaces it on hash change", async () => {
    const held = fixture();
    const ref = { kind: "externalFile::text", id: held.fileId };

    const first = await syncSemanticResourceFor(held.model, projectId, ref);
    assert.equal(first.outcome, "published");
    const firstSource = (held.store.read("semanticSources") as unknown as {
      rows: Array<{ contentHash?: string; revision: number }>;
    }).rows[0];
    assert.equal(firstSource.revision, 0);
    assert.equal(firstSource.contentHash, held.firstHash);
    assert.equal(semanticSourceIsCurrent(held.store, projectId, firstSource as never), true);
    const firstObject = (held.store.read("semanticObjects") as unknown as {
      rows: Array<{ span: { text: string } }>;
    }).rows[0];
    assert.equal(firstObject.span.text, "Gary is twenty-seven.");

    const calls = held.tokenCalls;
    assert.equal((await syncSemanticResourceFor(held.model, projectId, ref)).outcome, "current");
    assert.equal(held.tokenCalls, calls);

    held.store.update(`externalFiles.${held.fileId}.hash`, held.secondHash);
    assert.equal(semanticSourceIsCurrent(held.store, projectId, firstSource as never), false);
    const second = await syncSemanticResourceFor(held.model, projectId, ref);
    assert.equal(second.outcome, "published");
    const active = (held.store.read("semanticSources") as unknown as {
      rows: Array<{ contentHash?: string }>;
    }).rows;
    assert.equal(active.length, 1);
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
});
