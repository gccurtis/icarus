import assert from "node:assert/strict";
import { rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";

import { defineExternalFileStorage } from "$model/server/external-file-storage/definition";
import {
  cleanupStorageLocations,
  storageDescriptor,
  storageLocation,
  storageOwner
} from "$model/server/external-file-storage/test/unit/storage-fixture";

afterEach(cleanupStorageLocations);

describe("External native-file boundaries", () => {
  it("rejects corrupt or size-mismatched stored bytes", async () => {
    const directory = await storageLocation("icarus-external-storage-");
    const bytes = new TextEncoder().encode("expected");
    const ref = storageDescriptor(bytes);
    await writeFile(join(directory, ref.hash), "different");
    const storage = defineExternalFileStorage(directory);

    await assert.rejects(() => storage.read(ref), /SHA-256/);
    await rm(join(directory, ref.hash));
    await writeFile(join(directory, ref.hash), bytes);
    await assert.rejects(() => storage.read({ ...ref, size: ref.size + 1 }), /represented size/);
  });

  it("refuses symbolic links even when their target has the expected bytes", async () => {
    const directory = await storageLocation("icarus-external-storage-");
    const bytes = new TextEncoder().encode("not through a link");
    const ref = storageDescriptor(bytes);
    await writeFile(join(directory, "target"), bytes);
    await symlink("target", join(directory, ref.hash));

    await assert.rejects(
      () => defineExternalFileStorage(directory).read(ref),
      (error: NodeJS.ErrnoException) => error.code === "ELOOP"
    );
  });

  it("honors the operation signal before and during native reads", async () => {
    const directory = await storageLocation("icarus-external-storage-");
    const bytes = new TextEncoder().encode("cancelled");
    const ref = storageDescriptor(bytes);
    await writeFile(join(directory, ref.hash), bytes);
    const alreadyCancelled = new AbortController();
    alreadyCancelled.abort();

    await assert.rejects(
      () => defineExternalFileStorage(directory).read(ref, alreadyCancelled.signal),
      (error: Error) => error.name === "AbortError"
    );

    const inFlight = new AbortController();
    const reading = defineExternalFileStorage(directory).read(ref, inFlight.signal);
    inFlight.abort();
    await assert.rejects(reading, (error: Error) => error.name === "AbortError");
  });

  it("requires exact current publication and claim contracts", async () => {
    const storage = defineExternalFileStorage(await storageLocation("icarus-external-storage-"));
    const bytes = new TextEncoder().encode("exact receipt");
    const ref = storageDescriptor(bytes);
    const receipt = await storage.put({ ...ref, bytes, maxBytes: bytes.byteLength });

    await assert.rejects(
      () => storage.claimPublication(
        { ...receipt, reused: undefined } as unknown as typeof receipt,
        storageOwner("missing-decision")
      ),
      /exact current shape/
    );
    await assert.rejects(
      () => storage.claimPublication(
        { ...receipt, legacy: false } as unknown as typeof receipt,
        storageOwner("extra-field")
      ),
      /exact current shape/
    );
    await storage.discardPublication(receipt);
  });

  it("protects shared claims, removes idempotently, and serializes mutations", async () => {
    const storage = defineExternalFileStorage(await storageLocation("icarus-external-storage-"));
    const bytes = new TextEncoder().encode("bounded");
    const ref = storageDescriptor(bytes);
    await assert.rejects(() => storage.put({ ...ref, bytes, maxBytes: 3 }), /exceeds/);

    const first = await storage.put({ ...ref, bytes, maxBytes: bytes.byteLength });
    await storage.claimPublication(first, storageOwner("first"));
    const second = await storage.put({ ...ref, bytes, maxBytes: bytes.byteLength });
    await storage.claimPublication(second, storageOwner("second"));
    await storage.releaseClaim({ ...ref, ownerId: storageOwner("first") });
    assert.equal(await storage.remove(ref), "claimed");
    assert.deepEqual(await storage.read(ref), bytes);
    await storage.releaseClaim({ ...ref, ownerId: storageOwner("second") });
    assert.equal(await storage.remove(ref), "removed");
    assert.equal(await storage.remove(ref), "already-missing");

    const releaseFirst = await storage.acquireMutation();
    let entered = false;
    const waiting = storage.acquireMutation().then((release) => {
      entered = true;
      release();
    });
    await Promise.resolve();
    assert.equal(entered, false);
    releaseFirst();
    await waiting;
    assert.equal(entered, true);
  });
});
