import { constants } from "node:fs";
import { link, open, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Id } from "$representation/data/types/core/id";
import type { ExternalFileStorageRef } from "$model/server/external-file-storage/types";
import { claimName } from "$model/server/external-file-storage/methods/shared/names";
import { digest } from "$model/server/external-file-storage/methods/shared/validation";

export const syncDirectory = async (directory: string): Promise<void> => {
  const held = await open(directory, "r");
  try {
    await held.sync();
  } finally {
    await held.close();
  }
};

export const readNamedVerified = async (
  directory: string,
  name: string,
  ref: ExternalFileStorageRef,
  signal?: AbortSignal
): Promise<Uint8Array | undefined> => {
  signal?.throwIfAborted();
  let bytes: Buffer;
  try {
    bytes = await readFile(join(directory, name), {
      flag: constants.O_RDONLY | constants.O_NOFOLLOW,
      signal
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  if (digest(bytes) !== ref.hash) {
    throw new Error("stored external file does not match its SHA-256 hash");
  }
  if (bytes.byteLength !== ref.size) {
    throw new Error("stored external file does not match its represented size");
  }
  return new Uint8Array(bytes);
};

export const readVerified = async (
  directory: string,
  ref: ExternalFileStorageRef,
  signal?: AbortSignal
): Promise<Uint8Array | undefined> => readNamedVerified(directory, ref.hash, ref, signal);

export const createClaim = async (
  directory: string,
  hash: string,
  ownerId: Id<"externalFiles">
): Promise<void> => {
  let marker;
  try {
    marker = await open(join(directory, claimName(hash, ownerId)), "wx", 0o600);
    await marker.sync();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  } finally {
    await marker?.close();
  }
};

export const restoreCanonicalFrom = async (
  directory: string,
  sourceName: string,
  ref: ExternalFileStorageRef
): Promise<void> => {
  if (await readNamedVerified(directory, sourceName, ref) === undefined) {
    throw new Error("external file recovery copy is unavailable");
  }
  try {
    await link(join(directory, sourceName), join(directory, ref.hash));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (await readVerified(directory, ref) === undefined) {
    throw new Error("external file canonical publication is unavailable");
  }
};
