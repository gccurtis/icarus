import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";

import { defineExternalFileStorage } from "$model/server/external-file-storage/definition";
import { asId } from "$representation/data/behavior/core/id";
import type { Id } from "$representation/data/types/core/id";

const directories: string[] = [];
const location = async (label: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), label));
  directories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => {
    await rm(directory, { recursive: true, force: true });
  }));
});

const descriptor = (bytes: Uint8Array) => {
  const hash = createHash("sha256").update(bytes).digest("hex");
  return {
    storageId: `_storage:${hash}` as Id<"_storage">,
    hash,
    size: bytes.byteLength
  };
};

const owner = (suffix: string): Id<"externalFiles"> =>
  asId<"externalFiles">(`externalFiles:${suffix}`);

describe("External native-file storage", () => {
  it("accepts an External-derived descriptor and verifies it on write and read", async () => {
    const storage = defineExternalFileStorage(await location("icarus-external-storage-"));
    const bytes = new TextEncoder().encode("region,revenue\nNorth,120\n");
    const ref = descriptor(bytes);

    const first = await storage.put({ ...ref, bytes, maxBytes: bytes.byteLength });
    assert.deepEqual({ ...first, publicationToken: undefined }, {
      ...ref,
      reused: false,
      publicationToken: undefined
    });
    assert.match(first.publicationToken, /^\.publish\.[a-f0-9]{64}\.[0-9a-f-]{36}\.next$/);
    await storage.claimPublication(first, owner("first"));
    assert.deepEqual(await storage.read(ref), bytes);

    const second = await storage.put({ ...ref, bytes });
    assert.equal(second.reused, true);
    await storage.discardPublication(second);
    await assert.rejects(
      () => storage.put({ ...ref, hash: "b".repeat(64), bytes }),
      /admitted SHA-256/
    );
    await assert.rejects(
      () => storage.put({ ...ref, size: ref.size + 1, bytes }),
      /admitted size/
    );
  });

  it("reconciles interrupted and orphaned files without removing represented blobs", async () => {
    const primary = await location("icarus-external-primary-");
    const bytes = new TextEncoder().encode("represented file");
    const ref = descriptor(bytes);
    const storage = defineExternalFileStorage(primary);
    const receipt = await storage.put({ ...ref, bytes });
    await storage.claimPublication(receipt, owner("represented"));
    await writeFile(join(primary, `.${"a".repeat(64)}.attempt.next`), "partial");
    await writeFile(join(primary, "b".repeat(64)), "orphan");

    assert.deepEqual(await storage.reconcile([{ ...ref, ownerId: owner("represented") }]), {
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
    const ref = descriptor(bytes);

    for (const failpoint of ["put:after-temporary", "put:after-publish"] as const) {
      const primary = await location(`icarus-external-${failpoint.replaceAll(":", "-")}-`);
      const interrupted = defineExternalFileStorage(primary, (point) => {
        if (point === failpoint) throw new Error(`interrupted at ${point}`);
      });
      await assert.rejects(() => interrupted.put({ ...ref, bytes }), /interrupted/);
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
          await restarted.reconcile([{ ...ref, ownerId: owner("committed") }]),
          { removedTemporaryFiles: 1, removedOrphanBlobs: 0, retainedBlobs: 1 }
        );
        assert.deepEqual(await restarted.read(ref), bytes);
      }
    }
  });

  it("recovers an interrupted quarantine according to authoritative row claims", async () => {
    const primary = await location("icarus-external-quarantine-");
    const bytes = new TextEncoder().encode("claimed bytes");
    const ref = descriptor(bytes);
    const claimed = owner("claimed");
    const interrupted = defineExternalFileStorage(primary, (point) => {
      if (point === "remove:after-quarantine") throw new Error("interrupted quarantine");
    });
    const receipt = await interrupted.put({ ...ref, bytes });
    await interrupted.claimPublication(receipt, claimed);
    await interrupted.releaseClaim({ ...ref, ownerId: claimed });
    await assert.rejects(() => interrupted.remove(ref), /interrupted quarantine/);
    assert.equal((await readdir(primary)).some((name) => name.startsWith(`.garbage.${ref.hash}.`)), true);

    const restarted = defineExternalFileStorage(primary);
    assert.deepEqual(await restarted.reconcile([{ ...ref, ownerId: claimed }]), {
      removedTemporaryFiles: 1,
      removedOrphanBlobs: 0,
      retainedBlobs: 1
    });
    assert.deepEqual(await restarted.read(ref), bytes);
  });

  it("rejects corrupt or size-mismatched stored bytes", async () => {
    const directory = await location("icarus-external-storage-");
    const bytes = new TextEncoder().encode("expected");
    const ref = descriptor(bytes);
    await writeFile(join(directory, ref.hash), "different");
    const storage = defineExternalFileStorage(directory);

    await assert.rejects(() => storage.read(ref), /SHA-256/);
    await rm(join(directory, ref.hash));
    await writeFile(join(directory, ref.hash), bytes);
    await assert.rejects(() => storage.read({ ...ref, size: ref.size + 1 }), /represented size/);
  });

  it("protects shared claims, removes idempotently, and serializes only as an optimization", async () => {
    const storage = defineExternalFileStorage(await location("icarus-external-storage-"));
    const bytes = new TextEncoder().encode("bounded");
    const ref = descriptor(bytes);
    await assert.rejects(() => storage.put({ ...ref, bytes, maxBytes: 3 }), /exceeds/);

    const first = await storage.put({ ...ref, bytes });
    await storage.claimPublication(first, owner("first"));
    const second = await storage.put({ ...ref, bytes });
    await storage.claimPublication(second, owner("second"));
    await storage.releaseClaim({ ...ref, ownerId: owner("first") });
    assert.equal(await storage.remove(ref), "claimed");
    assert.deepEqual(await storage.read(ref), bytes);
    await storage.releaseClaim({ ...ref, ownerId: owner("second") });
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
