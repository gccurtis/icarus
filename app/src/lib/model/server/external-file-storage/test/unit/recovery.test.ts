import assert from "node:assert/strict";
import { readdir, unlink, writeFile } from "node:fs/promises";
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

describe("External native-file recovery", () => {
  it("reconciles interrupted and orphaned files without removing represented blobs", async () => {
    const primary = await storageLocation("icarus-external-primary-");
    const bytes = new TextEncoder().encode("represented file");
    const ref = storageDescriptor(bytes);
    const storage = defineExternalFileStorage(primary);
    const receipt = await storage.put({ ...ref, bytes, maxBytes: bytes.byteLength });
    await storage.claimPublication(receipt, storageOwner("represented"));
    await writeFile(join(primary, `.${"a".repeat(64)}.attempt.next`), "partial");
    await writeFile(join(primary, "b".repeat(64)), "orphan");

    assert.deepEqual(await storage.reconcile([{ ...ref, ownerId: storageOwner("represented") }]), {
      removedTemporaryFiles: 1,
      removedOrphanBlobs: 1,
      retainedBlobs: 1
    });
    assert.deepEqual(await storage.read(ref), bytes);
    const names = await readdir(primary);
    assert.equal(names.includes(ref.hash), true);
    assert.equal(names.some((name) => name.startsWith(`.claim.${ref.hash}.`)), true);
    assert.equal(names.length, 2);
  });

  it("recovers or removes every interrupted publication boundary on restart", async () => {
    const bytes = new TextEncoder().encode("recover publication");
    const ref = storageDescriptor(bytes);

    for (const failpoint of ["put:after-temporary", "put:after-publish"] as const) {
      const primary = await storageLocation(`icarus-external-${failpoint.replaceAll(":", "-")}-`);
      const interrupted = defineExternalFileStorage(primary, (point) => {
        if (point === failpoint) throw new Error(`interrupted at ${point}`);
      });
      await assert.rejects(
        () => interrupted.put({ ...ref, bytes, maxBytes: bytes.byteLength }),
        /interrupted/
      );
      const before = await readdir(primary);
      assert.equal(before.some((name) => name.startsWith(`.publish.${ref.hash}.`)), true);

      const restarted = defineExternalFileStorage(primary);
      if (failpoint === "put:after-temporary") {
        assert.deepEqual(await restarted.reconcile([]), {
          removedTemporaryFiles: 1,
          removedOrphanBlobs: 0,
          retainedBlobs: 0
        });
        assert.equal(await restarted.read(ref), undefined);
      } else {
        await unlink(join(primary, ref.hash));
        assert.deepEqual(
          await restarted.reconcile([{ ...ref, ownerId: storageOwner("committed") }]),
          { removedTemporaryFiles: 1, removedOrphanBlobs: 0, retainedBlobs: 1 }
        );
        assert.deepEqual(await restarted.read(ref), bytes);
      }
    }
  });

  it("recovers an interrupted quarantine according to authoritative row claims", async () => {
    const primary = await storageLocation("icarus-external-quarantine-");
    const bytes = new TextEncoder().encode("claimed bytes");
    const ref = storageDescriptor(bytes);
    const claimed = storageOwner("claimed");
    const interrupted = defineExternalFileStorage(primary, (point) => {
      if (point === "remove:after-quarantine") throw new Error("interrupted quarantine");
    });
    const receipt = await interrupted.put({ ...ref, bytes, maxBytes: bytes.byteLength });
    await interrupted.claimPublication(receipt, claimed);
    await interrupted.releaseClaim({ ...ref, ownerId: claimed });
    await assert.rejects(() => interrupted.remove(ref), /interrupted quarantine/);
    assert.equal(
      (await readdir(primary)).some((name) => name.startsWith(`.garbage.${ref.hash}.`)),
      true
    );

    const restarted = defineExternalFileStorage(primary);
    assert.deepEqual(await restarted.reconcile([{ ...ref, ownerId: claimed }]), {
      removedTemporaryFiles: 1,
      removedOrphanBlobs: 0,
      retainedBlobs: 1
    });
    assert.deepEqual(await restarted.read(ref), bytes);
  });

  it("fails reconciliation when an authoritative row has no recoverable bytes", async () => {
    const storage = defineExternalFileStorage(await storageLocation("icarus-external-storage-"));
    const ref = storageDescriptor(new TextEncoder().encode("missing"));
    await assert.rejects(
      () => storage.reconcile([{ ...ref, ownerId: storageOwner("unrecoverable") }]),
      /has no recoverable native bytes/
    );
  });
});
