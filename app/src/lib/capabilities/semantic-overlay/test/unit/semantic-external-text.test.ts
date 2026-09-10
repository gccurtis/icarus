import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { defineStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { readMaterialInventoryFor } from "$capabilities/semantic-overlay/api/shared/material-resource";
import { readSemanticResourceForModel } from "$capabilities/semantic-overlay/api/shared/resource";

const projectId = "projects:external-text" as Id<"projects">;

describe("External prose semantic boundary", () => {
  it("reads current prose through the exact-text lane and never profiles it as code", async () => {
    const store = defineStore({});
    const hash = "a".repeat(64);
    const fileId = store.create("externalFiles", {
      projectId,
      name: "facts.md",
      originalName: "facts.md",
      relativePath: "facts.md",
      mediaType: "text/markdown",
      subkind: "text",
      storageId: `_storage:${hash}`,
      hash,
      size: 21,
      origin: { kind: "upload" },
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    });
    let nativeReads = 0;
    const model = {
      store,
      configuration: { get: () => undefined },
      externalFileStorage: {
        read: async () => {
          nativeReads += 1;
          return new TextEncoder().encode("Gary is twenty-seven.");
        }
      }
    } as unknown as ServerModel;
    const ref = { kind: "externalFile::text", id: fileId };

    const inventory = await readMaterialInventoryFor(model, projectId, ref);
    assert.deepEqual(inventory?.seeds, []);
    assert.equal(nativeReads, 0, "the material lane does not read prose bytes");

    const exact = await readSemanticResourceForModel(model, projectId, ref);
    assert.deepEqual(exact, {
      ref,
      revision: 1,
      contentHash: hash,
      text: "Gary is twenty-seven.",
      encoding: "utf-16",
      locators: [{ from: 0, to: 21, locator: { kind: "externalFileContent" } }],
      hardBoundaries: []
    });
    assert.equal(nativeReads, 1);
  });
});
