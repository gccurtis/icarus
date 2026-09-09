import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { defineStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import { semanticSourceIsCurrent } from "$capabilities/semantic-overlay/api/shared/freshness";
import {
  materialDescriptorInputHash,
  shouldDescribeMaterial
} from "$capabilities/semantic-overlay/api/shared/material-description";
import { readMaterialInventoryFor } from "$capabilities/semantic-overlay/api/shared/material-resource";
import { syncSemanticResourceFor } from "$capabilities/semantic-overlay/api/shared/sync";

const projectId = "projects:external-text" as Id<"projects">;

describe("External textual material boundary", () => {
  it("canonicalizes legacy text as one code material while keeping the exact lane stale", async () => {
    const store = defineStore({});
    const hash = "a".repeat(64);
    const fileId = store.create("externalFiles", {
      projectId,
      name: "facts.md",
      mediaType: "text/markdown",
      subkind: "text",
      storageId: `_storage:${hash}`,
      hash,
      size: 22,
      origin: { kind: "upload" },
      createdBy: { kind: "system" },
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

    const inventory = await readMaterialInventoryFor(model, projectId, {
      kind: "externalFile",
      id: fileId
    });
    assert.equal(inventory?.seeds.length, 1);
    const seed = inventory?.seeds[0];
    assert.equal(seed?.kind, "code");
    assert.equal(seed?.source.kind === "externalFile" ? seed.source.ref.kind : undefined, "externalFile::code");
    assert.equal(seed?.profile.kind === "code" ? seed.profile.language : undefined, "markdown");
    assert.equal(seed?.sourceText, "Gary is twenty-seven.");
    assert.equal(seed === undefined ? false : shouldDescribeMaterial(seed), true);
    if (seed !== undefined) {
      assert.notEqual(
        materialDescriptorInputHash(seed),
        materialDescriptorInputHash({ ...seed, sourceText: "Different verified text." })
      );
    }

    const result = await syncSemanticResourceFor(model, projectId, ref);
    assert.equal(result.outcome, "missing");
    assert.equal(nativeReads, 1);
    assert.equal(
      (store.read("semanticSources") as unknown as { rows: unknown[] }).rows.length,
      0
    );
    assert.equal(semanticSourceIsCurrent(store, projectId, {
      ref,
      revision: 0,
      contentHash: hash
    }), false);
  });
});
