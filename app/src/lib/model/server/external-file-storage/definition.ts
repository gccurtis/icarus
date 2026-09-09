import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  ExternalFileStorageModel,
  ExternalFileStoragePutInput,
  ExternalFileStorageRef
} from "$model/server/external-file-storage/types";

const digest = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const safeHash = (value: string): string => {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("external file hash must be SHA-256");
  return value.toLowerCase();
};

const safeSize = (value: number | undefined): number | undefined => {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error("external file size must be a non-negative safe integer");
  }
  return value;
};

const safeStorageId = (storageId: string, hash: string): void => {
  if (typeof storageId !== "string" || storageId !== `_storage:${hash}`) {
    throw new Error("external file storage id must match its admitted SHA-256 hash");
  }
};

const validatePut = (input: ExternalFileStoragePutInput): Required<ExternalFileStorageRef> => {
  if (!(input?.bytes instanceof Uint8Array)) throw new Error("external file bytes are required");
  const hash = safeHash(input.hash);
  const size = safeSize(input.size);
  if (size === undefined || size !== input.bytes.byteLength) {
    throw new Error("external file bytes do not match their admitted size");
  }
  if (
    input.maxBytes !== undefined &&
    (!Number.isSafeInteger(input.maxBytes) || input.maxBytes < 0)
  ) {
    throw new Error("external file maxBytes must be a non-negative safe integer");
  }
  if (input.maxBytes !== undefined && size > input.maxBytes) {
    throw new Error(`external file exceeds the ${input.maxBytes} byte limit`);
  }
  if (digest(input.bytes) !== hash) {
    throw new Error("external file bytes do not match their admitted SHA-256 hash");
  }
  safeStorageId(input.storageId, hash);
  return { storageId: input.storageId, hash, size };
};

const readFrom = async (
  directory: string,
  hash: string
): Promise<Uint8Array | undefined> => {
  try {
    return new Uint8Array(await readFile(join(directory, hash)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const readVerified = async (
  directories: readonly string[],
  ref: ExternalFileStorageRef
): Promise<Uint8Array | undefined> => {
  const expectedHash = safeHash(ref.hash);
  safeStorageId(ref.storageId, expectedHash);
  const expectedSize = safeSize(ref.size);
  for (const directory of directories) {
    const bytes = await readFrom(directory, expectedHash);
    if (bytes === undefined) continue;
    if (digest(bytes) !== expectedHash) {
      throw new Error("stored external file does not match its SHA-256 hash");
    }
    if (expectedSize !== undefined && bytes.byteLength !== expectedSize) {
      throw new Error("stored external file does not match its represented size");
    }
    return bytes;
  }
  return undefined;
};

export const defineExternalFileStorage = (
  primaryDirectory: string,
  legacyDirectories: readonly string[] = []
): ExternalFileStorageModel => {
  const directories = [primaryDirectory, ...legacyDirectories]
    .filter((value, index, values) => values.indexOf(value) === index);
  let mutationTail: Promise<void> = Promise.resolve();

  return {
    async acquireMutation() {
      const previous = mutationTail;
      let release = (): void => undefined;
      mutationTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      return release;
    },

    async put(input) {
      const admitted = validatePut(input);
      const held = await readVerified(directories, admitted);
      if (held !== undefined) return { ...admitted, reused: true };

      await mkdir(primaryDirectory, { recursive: true });
      const temporary = join(primaryDirectory, `.${admitted.hash}.${randomUUID()}.next`);
      try {
        await writeFile(temporary, input.bytes, { flag: "wx" });
        await rename(temporary, join(primaryDirectory, admitted.hash));
      } finally {
        await rm(temporary, { force: true });
      }
      return { ...admitted, reused: false };
    },

    read(ref) {
      return readVerified(directories, ref);
    },

    async remove(ref) {
      const hash = safeHash(ref.hash);
      safeStorageId(ref.storageId, hash);
      safeSize(ref.size);
      let removed = false;
      for (const directory of directories) {
        try {
          await rm(join(directory, hash));
          removed = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      return removed;
    }
  };
};
