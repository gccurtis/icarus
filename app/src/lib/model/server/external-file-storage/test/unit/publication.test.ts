import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";

import { createExternalFileStorage } from "$model/server/external-file-storage/constructor";
import { defineExternalFileStorage } from "$model/server/external-file-storage/definition";
import type { Configuration } from "$model/server/configuration/index.server";
import type { Id } from "$representation/data/types/core/id";
import {
  cleanupStorageLocations,
  storageDescriptor,
  storageLocation,
  storageOwner
} from "$model/server/external-file-storage/test/unit/storage-fixture";

afterEach(cleanupStorageLocations);

describe("External native-file publication", () => {
  it("requires one explicit current repository location", async () => {
    const configured = await storageLocation("icarus-external-configured-");
    const configuration: Configuration = {
      get: (key) => key === "externalFiles.storage.directory" ? configured : undefined
    };
    const storage = createExternalFileStorage(configuration);
    const bytes = new TextEncoder().encode("configured repository");
    const ref = storageDescriptor(bytes);
    const receipt = await storage.put({ ...ref, bytes, maxBytes: bytes.byteLength });
    await storage.claimPublication(receipt, storageOwner("configured"));
    assert.deepEqual(await storage.read(ref), bytes);

    assert.throws(
      () => createExternalFileStorage({ get: () => undefined }),
      /externalFiles\.storage\.directory.*non-empty string/
    );
    assert.throws(
      () => createExternalFileStorage(configuration, "   "),
      /directory override must be a non-empty string/
    );
  });

  it("accepts an External-derived descriptor and verifies it on write and read", async () => {
    const storage = defineExternalFileStorage(await storageLocation("icarus-external-storage-"));
    const bytes = new TextEncoder().encode("region,revenue\nNorth,120\n");
    const ref = storageDescriptor(bytes);

    const first = await storage.put({ ...ref, bytes, maxBytes: bytes.byteLength });
    assert.deepEqual({ ...first, publicationToken: undefined }, {
      ...ref,
      reused: false,
      publicationToken: undefined
    });
    assert.match(first.publicationToken, /^\.publish\.[a-f0-9]{64}\.[0-9a-f-]{36}\.next$/);
    await storage.claimPublication(first, storageOwner("first"));
    assert.deepEqual(await storage.read(ref), bytes);

    const second = await storage.put({ ...ref, bytes, maxBytes: bytes.byteLength });
    assert.equal(second.reused, true);
    await storage.discardPublication(second);
    await assert.rejects(
      () => storage.put({ ...ref, hash: "b".repeat(64), bytes, maxBytes: bytes.byteLength }),
      /admitted SHA-256/
    );
    await assert.rejects(
      () => storage.put({ ...ref, size: ref.size + 1, bytes, maxBytes: bytes.byteLength }),
      /admitted size/
    );
    await assert.rejects(() => storage.read({ ...ref, hash: "../outside" }), /lowercase SHA-256/);
    await assert.rejects(
      () => storage.read({ ...ref, storageId: "_storage:other" as Id<"_storage"> }),
      /must match its admitted SHA-256 hash/
    );
  });
});
