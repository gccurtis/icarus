import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  MaterialContentModel,
  MaterialContentRef
} from "$model/server/material-content/types";

const safeHash = (value: string): string => {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error("material content hash must be SHA-256");
  return value.toLowerCase();
};

export const defineMaterialContent = (directory: string): MaterialContentModel => ({
  async read(ref: MaterialContentRef, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const expected = safeHash(ref.hash);
    try {
      const bytes = await readFile(join(directory, expected), { signal });
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== expected) throw new Error("stored material content does not match its SHA-256 hash");
      return new Uint8Array(bytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
});
