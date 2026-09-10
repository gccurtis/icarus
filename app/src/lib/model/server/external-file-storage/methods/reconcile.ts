import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type { ExternalFileStorageState } from "$model/server/external-file-storage/definition";
import type {
  ExternalFileStorageClaim,
  ExternalFileStorageReconciliation
} from "$model/server/external-file-storage/types";
import {
  createClaim,
  readVerified,
  restoreCanonicalFrom,
  syncDirectory
} from "$model/server/external-file-storage/methods/shared/io";
import {
  claimName,
  garbageHash,
  publicationHash
} from "$model/server/external-file-storage/methods/shared/names";
import { validateClaim } from "$model/server/external-file-storage/methods/shared/validation";

const claimsByHash = (
  references: readonly ExternalFileStorageClaim[]
): ReadonlyMap<string, readonly ExternalFileStorageClaim[]> => {
  const grouped = new Map<string, ExternalFileStorageClaim[]>();
  for (const reference of references) {
    grouped.set(reference.hash, [...(grouped.get(reference.hash) ?? []), reference]);
  }
  return grouped;
};

const restoreRepresented = async (
  state: ExternalFileStorageState,
  references: ReadonlyMap<string, readonly ExternalFileStorageClaim[]>,
  names: readonly string[]
): Promise<void> => {
  for (const [hash, claims] of references) {
    const reference = claims[0]!;
    if (claims.some((claim) => claim.size !== reference.size)) {
      throw new Error(`represented external files disagree on size for '${hash}'`);
    }
    if (await readVerified(state.directory, reference) === undefined) {
      const candidates = names.filter((name) =>
        publicationHash(name) === hash || garbageHash(name) === hash
      );
      let restored = false;
      for (const candidate of candidates) {
        try {
          await restoreCanonicalFrom(state.directory, candidate, reference);
          restored = true;
          break;
        } catch {
          // Corrupt recovery candidates are reclaimed after all candidates are tried.
        }
      }
      if (!restored) {
        throw new Error(`represented external file '${hash}' has no recoverable native bytes`);
      }
    }
    for (const claim of claims) await createClaim(state.directory, hash, claim.ownerId);
  }
};

export const reconcile = async (
  state: ExternalFileStorageState,
  untrustedReferences: readonly ExternalFileStorageClaim[]
): Promise<ExternalFileStorageReconciliation> => {
  const references = untrustedReferences.map(validateClaim);
  await mkdir(state.directory, { recursive: true });
  await restoreRepresented(state, claimsByHash(references), await readdir(state.directory));

  const expectedClaims = new Set(references.map((reference) =>
    claimName(reference.hash, reference.ownerId)
  ));
  const retainedHashes = new Set(references.map((reference) => reference.hash));
  let removedTemporaryFiles = 0;
  let removedOrphanBlobs = 0;
  let retainedBlobs = 0;
  let changed = false;
  for (const name of await readdir(state.directory)) {
    if (expectedClaims.has(name)) continue;
    if (/^[a-f0-9]{64}$/.test(name) && retainedHashes.has(name)) {
      retainedBlobs += 1;
      continue;
    }
    await rm(join(state.directory, name), { recursive: true, force: true });
    changed = true;
    if (name.startsWith(".")) removedTemporaryFiles += 1;
    else removedOrphanBlobs += 1;
  }
  if (changed || references.length > 0) await syncDirectory(state.directory);
  return { removedTemporaryFiles, removedOrphanBlobs, retainedBlobs };
};
