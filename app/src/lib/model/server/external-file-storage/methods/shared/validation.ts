import { createHash } from "node:crypto";

import type { Id } from "$representation/data/types/core/id";
import type {
  ExternalFileStorageClaim,
  ExternalFileStoragePutInput,
  ExternalFileStorageReceipt,
  ExternalFileStorageRef
} from "$model/server/external-file-storage/types";
import { publicationHash } from "$model/server/external-file-storage/methods/shared/names";

export const digest = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

function exactObject(
  value: unknown,
  fields: readonly string[],
  label: string
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} has the exact current shape`);
  }
  const prototype = Object.getPrototypeOf(value);
  const keys = Reflect.ownKeys(value);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.length !== fields.length ||
    keys.some((key) => typeof key !== "string" || !fields.includes(key)) ||
    fields.some((field) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      return descriptor === undefined || !("value" in descriptor) ||
        !descriptor.enumerable || descriptor.value === undefined;
    })
  ) throw new Error(`${label} has the exact current shape`);
}

const descriptor = (ref: ExternalFileStorageRef): ExternalFileStorageRef => {
  if (!/^[a-f0-9]{64}$/.test(ref.hash)) {
    throw new Error("external file hash must be lowercase SHA-256");
  }
  if (!Number.isSafeInteger(ref.size) || ref.size < 0) {
    throw new Error("external file size must be a non-negative safe integer");
  }
  if (typeof ref.storageId !== "string" || ref.storageId !== `_storage:${ref.hash}`) {
    throw new Error("external file storage id must match its admitted SHA-256 hash");
  }
  return { storageId: ref.storageId, hash: ref.hash, size: ref.size };
};

export const validateRef = (ref: ExternalFileStorageRef): ExternalFileStorageRef => {
  exactObject(ref, ["storageId", "hash", "size"], "external file storage reference");
  return descriptor(ref);
};

export const validateOwnerId = (ownerId: string): Id<"externalFiles"> => {
  if (
    typeof ownerId !== "string" ||
    !ownerId.startsWith("externalFiles:") ||
    ownerId.length <= "externalFiles:".length ||
    ownerId.length > 500 ||
    /[.:\s]/.test(ownerId.slice("externalFiles:".length))
  ) throw new Error("external file storage owner id must be canonical");
  return ownerId as Id<"externalFiles">;
};

export const validateClaim = (claim: ExternalFileStorageClaim): ExternalFileStorageClaim => {
  exactObject(
    claim,
    ["storageId", "hash", "size", "ownerId"],
    "external file storage claim"
  );
  return { ...descriptor(claim), ownerId: validateOwnerId(claim.ownerId) };
};

export const validatePut = (input: ExternalFileStoragePutInput): ExternalFileStorageRef => {
  exactObject(
    input,
    ["storageId", "hash", "size", "bytes", "maxBytes"],
    "external file publication input"
  );
  if (!(input.bytes instanceof Uint8Array)) throw new Error("external file bytes are required");
  const admitted = descriptor(input);
  if (admitted.size !== input.bytes.byteLength) {
    throw new Error("external file bytes do not match their admitted size");
  }
  if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes <= 0) {
    throw new Error("external file maxBytes must be a positive safe integer");
  }
  if (admitted.size > input.maxBytes) {
    throw new Error(`external file exceeds the ${input.maxBytes} byte limit`);
  }
  if (digest(input.bytes) !== admitted.hash) {
    throw new Error("external file bytes do not match their admitted SHA-256 hash");
  }
  return admitted;
};

export const validateReceipt = (
  receipt: ExternalFileStorageReceipt
): ExternalFileStorageReceipt => {
  exactObject(
    receipt,
    ["storageId", "hash", "size", "reused", "publicationToken"],
    "external file publication receipt"
  );
  const ref = descriptor(receipt);
  if (
    typeof receipt.publicationToken !== "string" ||
    publicationHash(receipt.publicationToken) !== ref.hash
  ) throw new Error("external file publication token is canonical and hash-bound");
  if (typeof receipt.reused !== "boolean") {
    throw new Error("external file publication receipt requires an exact reused decision");
  }
  return { ...ref, reused: receipt.reused, publicationToken: receipt.publicationToken };
};
