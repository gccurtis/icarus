import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { asId } from "$representation/data/behavior/core/id";
import type { Id } from "$representation/data/types/core/id";

const directories: string[] = [];

export const storageLocation = async (label: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), label));
  directories.push(directory);
  return directory;
};

export const cleanupStorageLocations = async (): Promise<void> => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
};

export const storageDescriptor = (bytes: Uint8Array) => {
  const hash = createHash("sha256").update(bytes).digest("hex");
  return {
    storageId: `_storage:${hash}` as Id<"_storage">,
    hash,
    size: bytes.byteLength
  };
};

export const storageOwner = (suffix: string): Id<"externalFiles"> =>
  asId<"externalFiles">(`externalFiles:${suffix}`);
