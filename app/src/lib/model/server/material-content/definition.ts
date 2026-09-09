import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { asId } from "$representation/data/behavior/core/id";
import type {
  MaterialContentModel,
  MaterialContentPutInput,
  MaterialContentRef
} from "$model/server/material-content/types";

const safeHash = (value: string): string => {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("material content hash must be SHA-256");
  return value.toLowerCase();
};

const digest = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const readVerified = async (
  directory: string,
  ref: MaterialContentRef
): Promise<Uint8Array | undefined> => {
    const expected = safeHash(ref.hash);
    try {
      const bytes = await readFile(join(directory, expected));
      const actual = digest(bytes);
      if (actual !== expected) throw new Error("stored material content does not match its SHA-256 hash");
      return new Uint8Array(bytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
};

const validatePut = (input: MaterialContentPutInput): Uint8Array => {
  if (!(input?.bytes instanceof Uint8Array)) {
    throw new Error("material content bytes are required");
  }
  if (
    input.maxBytes !== undefined &&
    (!Number.isSafeInteger(input.maxBytes) || input.maxBytes < 0)
  ) {
    throw new Error("material content maxBytes must be a non-negative safe integer");
  }
  if (input.maxBytes !== undefined && input.bytes.byteLength > input.maxBytes) {
    throw new Error(`material content exceeds the ${input.maxBytes} byte limit`);
  }
  return input.bytes;
};

export const defineMaterialContent = (directory: string): MaterialContentModel => {
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
      const bytes = validatePut(input);
      const hash = digest(bytes);
      const storageId = asId<"_storage">(`_storage:${hash}`);
      const ref = { storageId, hash };
      const held = await readVerified(directory, ref);
      if (held !== undefined) {
        return { ...ref, size: held.byteLength, reused: true };
      }

      await mkdir(directory, { recursive: true });
      const temporary = join(directory, `.${hash}.${randomUUID()}.next`);
      try {
        await writeFile(temporary, bytes, { flag: "wx" });
        // A complete sibling is atomically made authoritative. Concurrent writers
        // may replace it only with bytes carrying the same digest.
        await rename(temporary, join(directory, hash));
      } finally {
        await rm(temporary, { force: true });
      }
      return { ...ref, size: bytes.byteLength, reused: false };
    },

    read(ref) {
      return readVerified(directory, ref);
    },

    async remove(ref) {
      const hash = safeHash(ref.hash);
      try {
        await rm(join(directory, hash));
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    }
  };
};
