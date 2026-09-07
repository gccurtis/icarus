import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";

import { defineMaterialContent } from "$model/server/material-content/definition";
import type { Id } from "$representation/data/types/core/id";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => {
    await rm(directory, { recursive: true, force: true });
  }));
});

describe("native semantic material content", () => {
  it("reads only a content-addressed value whose bytes match its SHA-256 name", async () => {
    const directory = await mkdtemp(join(tmpdir(), "icarus-material-content-"));
    directories.push(directory);
    const bytes = new TextEncoder().encode("region,revenue\nNorth,120\n");
    const hash = createHash("sha256").update(bytes).digest("hex");
    await writeFile(join(directory, hash), bytes);
    const content = defineMaterialContent(directory);

    assert.deepEqual(
      await content.read({ storageId: "_storage:test" as Id<"_storage">, hash }),
      bytes
    );
    assert.equal(
      await content.read({ storageId: "_storage:missing" as Id<"_storage">, hash: "b".repeat(64) }),
      undefined
    );
    await assert.rejects(
      () => content.read({ storageId: "_storage:escape" as Id<"_storage">, hash: "../outside" }),
      /must be SHA-256/
    );
  });

  it("rejects corrupt bytes even when a file is stored under a valid digest name", async () => {
    const directory = await mkdtemp(join(tmpdir(), "icarus-material-content-"));
    directories.push(directory);
    const claimed = "c".repeat(64);
    await writeFile(join(directory, claimed), "different bytes");

    await assert.rejects(
      () => defineMaterialContent(directory).read({
        storageId: "_storage:corrupt" as Id<"_storage">,
        hash: claimed
      }),
      /does not match/
    );
  });
});
