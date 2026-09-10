import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, mkdir, open, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import type { Id } from "$representation/data/types/core/id";
import type {
  ExternalFileStorageClaim,
  ExternalFileStorageModel,
  ExternalFileStorageFailpoint,
  ExternalFileStoragePutInput,
  ExternalFileStorageReceipt,
  ExternalFileStorageRef
} from "$model/server/external-file-storage/types";

const digest = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const ownerDigest = (ownerId: string): string =>
  createHash("sha256").update(ownerId).digest("hex");

const safeHash = (value: string): string => {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("external file hash must be lowercase SHA-256");
  }
  return value;
};

const safeSize = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("external file size must be a non-negative safe integer");
  }
  return value;
};

const safeStorageId = (storageId: string, hash: string): void => {
  if (typeof storageId !== "string" || storageId !== `_storage:${hash}`) {
    throw new Error("external file storage id must match its admitted SHA-256 hash");
  }
};

const safeOwnerId = (ownerId: string): Id<"externalFiles"> => {
  if (
    typeof ownerId !== "string" ||
    !ownerId.startsWith("externalFiles:") ||
    ownerId.length <= "externalFiles:".length ||
    ownerId.length > 500 ||
    /[.:\s]/.test(ownerId.slice("externalFiles:".length))
  ) throw new Error("external file storage owner id must be canonical");
  return ownerId as Id<"externalFiles">;
};

const validateRef = (ref: ExternalFileStorageRef): ExternalFileStorageRef => {
  const hash = safeHash(ref.hash);
  const size = safeSize(ref.size);
  safeStorageId(ref.storageId, hash);
  return { storageId: ref.storageId, hash, size };
};

const validatePut = (input: ExternalFileStoragePutInput): ExternalFileStorageRef => {
  if (!(input?.bytes instanceof Uint8Array)) throw new Error("external file bytes are required");
  const admitted = validateRef(input);
  if (admitted.size !== input.bytes.byteLength) {
    throw new Error("external file bytes do not match their admitted size");
  }
  if (
    input.maxBytes !== undefined &&
    (!Number.isSafeInteger(input.maxBytes) || input.maxBytes < 0)
  ) {
    throw new Error("external file maxBytes must be a non-negative safe integer");
  }
  if (input.maxBytes !== undefined && admitted.size > input.maxBytes) {
    throw new Error(`external file exceeds the ${input.maxBytes} byte limit`);
  }
  if (digest(input.bytes) !== admitted.hash) {
    throw new Error("external file bytes do not match their admitted SHA-256 hash");
  }
  return admitted;
};

const publicationName = (hash: string): string =>
  `.publish.${hash}.${randomUUID()}.next`;

const garbageName = (hash: string): string =>
  `.garbage.${hash}.${randomUUID()}.next`;

const claimName = (hash: string, ownerId: string): string =>
  `.claim.${hash}.${ownerDigest(ownerId)}`;

const publicationHash = (name: string): string | undefined =>
  /^\.publish\.([a-f0-9]{64})\.[0-9a-f-]{36}\.next$/.exec(name)?.[1];

const garbageHash = (name: string): string | undefined =>
  /^\.garbage\.([a-f0-9]{64})\.[0-9a-f-]{36}\.next$/.exec(name)?.[1];

const safePublication = (
  receipt: ExternalFileStorageReceipt
): ExternalFileStorageReceipt => {
  const ref = validateRef(receipt);
  if (
    typeof receipt.publicationToken !== "string" ||
    publicationHash(receipt.publicationToken) !== ref.hash
  ) throw new Error("external file publication token is canonical and hash-bound");
  return { ...ref, reused: receipt.reused === true, publicationToken: receipt.publicationToken };
};

const readNamed = async (
  directory: string,
  name: string
): Promise<Uint8Array | undefined> => {
  let file;
  try {
    file = await open(join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW);
    return new Uint8Array(await file.readFile());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  } finally {
    await file?.close();
  }
};

const readNamedVerified = async (
  directory: string,
  name: string,
  ref: ExternalFileStorageRef
): Promise<Uint8Array | undefined> => {
  const expected = validateRef(ref);
  const bytes = await readNamed(directory, name);
  if (bytes === undefined) return undefined;
  if (digest(bytes) !== expected.hash) {
    throw new Error("stored external file does not match its SHA-256 hash");
  }
  if (bytes.byteLength !== expected.size) {
    throw new Error("stored external file does not match its represented size");
  }
  return bytes;
};

const readVerified = async (
  directory: string,
  ref: ExternalFileStorageRef
): Promise<Uint8Array | undefined> => readNamedVerified(directory, ref.hash, ref);

/** Instance-owned process-lifetime optimization state for one native repository. */
class ExternalFileStorageState {
  mutationTail: Promise<void> = Promise.resolve();

  constructor(
    readonly directory: string,
    readonly failpoint?: (point: ExternalFileStorageFailpoint) => void
  ) {}
}

const syncDirectory = async (directory: string): Promise<void> => {
  const held = await open(directory, "r");
  try {
    await held.sync();
  } finally {
    await held.close();
  }
};

const linkPublication = async (
  directory: string,
  token: string,
  admitted: ExternalFileStorageRef
): Promise<boolean> => {
  try {
    await link(join(directory, token), join(directory, admitted.hash));
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (await readVerified(directory, admitted) === undefined) {
      throw new Error("the canonical external file disappeared during publication");
    }
    return true;
  }
};

/**
 * Publishes canonical bytes while retaining a durable recovery copy. The copy
 * is converted to a row claim only after the caller's Store transaction wins.
 */
const publish = async (
  state: ExternalFileStorageState,
  input: ExternalFileStoragePutInput,
  admitted: ExternalFileStorageRef
): Promise<ExternalFileStorageReceipt> => {
  await mkdir(state.directory, { recursive: true });
  const publicationToken = publicationName(admitted.hash);
  let file;
  let recoveryReady = false;
  try {
    file = await open(join(state.directory, publicationToken), "wx", 0o600);
    await file.writeFile(input.bytes);
    await file.sync();
    await file.close();
    file = undefined;
    recoveryReady = true;
    state.failpoint?.("put:after-temporary");
    const reused = await linkPublication(state.directory, publicationToken, admitted);
    await syncDirectory(state.directory);
    state.failpoint?.("put:after-publish");
    return { ...admitted, reused, publicationToken };
  } finally {
    await file?.close();
    // A complete, fsynced recovery copy models process interruption and is
    // deliberately left for startup reconciliation after any later failure.
    if (!recoveryReady) await rm(join(state.directory, publicationToken), { force: true });
  }
};

const createClaim = async (
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

const restoreCanonicalFrom = async (
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

const protectedHash = async (directory: string, hash: string): Promise<boolean> =>
  (await readdir(directory)).some((name) =>
    name.startsWith(`.claim.${hash}.`) || name.startsWith(`.publish.${hash}.`)
  );

export const defineExternalFileStorage = (
  directory: string,
  failpoint?: (point: ExternalFileStorageFailpoint) => void
): ExternalFileStorageModel => {
  const state = new ExternalFileStorageState(directory, failpoint);

  return {
    async acquireMutation() {
      const previous = state.mutationTail;
      let release = (): void => undefined;
      state.mutationTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      return release;
    },

    async put(input) {
      const admitted = validatePut(input);
      return publish(state, input, admitted);
    },

    async claimPublication(untrustedReceipt, untrustedOwnerId) {
      const receipt = safePublication(untrustedReceipt);
      const ownerId = safeOwnerId(untrustedOwnerId);
      await mkdir(state.directory, { recursive: true });
      await createClaim(state.directory, receipt.hash, ownerId);
      // The claim becomes visible before the recovery copy can disappear. A
      // concurrent collector must restore rather than delete a claimed hash.
      await syncDirectory(state.directory);
      if (await readVerified(state.directory, receipt) === undefined) {
        await restoreCanonicalFrom(state.directory, receipt.publicationToken, receipt);
      }
      await rm(join(state.directory, receipt.publicationToken), { force: true });
      await syncDirectory(state.directory);
    },

    async discardPublication(untrustedReceipt) {
      const receipt = safePublication(untrustedReceipt);
      await rm(join(state.directory, receipt.publicationToken), { force: true });
      await syncDirectory(state.directory);
    },

    async releaseClaim(untrustedClaim) {
      const claim = validateRef(untrustedClaim);
      const ownerId = safeOwnerId(untrustedClaim.ownerId);
      await rm(join(state.directory, claimName(claim.hash, ownerId)), { force: true });
      await syncDirectory(state.directory);
    },

    read(ref) {
      return readVerified(state.directory, ref);
    },

    async remove(untrustedRef) {
      const ref = validateRef(untrustedRef);
      await mkdir(state.directory, { recursive: true });
      const quarantined = garbageName(ref.hash);
      try {
        await rename(join(state.directory, ref.hash), join(state.directory, quarantined));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return await protectedHash(state.directory, ref.hash) ? "claimed" : "already-missing";
      }
      await syncDirectory(state.directory);
      state.failpoint?.("remove:after-quarantine");

      if (await protectedHash(state.directory, ref.hash)) {
        if (await readVerified(state.directory, ref) === undefined) {
          await restoreCanonicalFrom(state.directory, quarantined, ref);
        }
        await rm(join(state.directory, quarantined), { force: true });
        await syncDirectory(state.directory);
        return "claimed";
      }
      await rm(join(state.directory, quarantined), { force: true });
      await syncDirectory(state.directory);
      return "removed";
    },

    async reconcile(untrustedReferences) {
      const references = untrustedReferences.map((reference) => ({
        ...validateRef(reference),
        ownerId: safeOwnerId(reference.ownerId)
      }));
      const byHash = new Map<string, ExternalFileStorageClaim[]>();
      for (const reference of references) {
        byHash.set(reference.hash, [...(byHash.get(reference.hash) ?? []), reference]);
      }
      await mkdir(state.directory, { recursive: true });
      let names = await readdir(state.directory);

      // Journal recovery has already established authoritative rows. Restore a
      // canonical value from an interrupted publication/quarantine before any
      // recovery artifact is reclaimed.
      for (const [hash, claims] of byHash) {
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
              // A partial/corrupt candidate is removed below; try another one.
            }
          }
          if (!restored) {
            throw new Error(`represented external file '${hash}' has no recoverable native bytes`);
          }
        }
        for (const claim of claims) await createClaim(state.directory, hash, claim.ownerId);
      }

      const expectedClaims = new Set(references.map((reference) =>
        claimName(reference.hash, reference.ownerId)
      ));
      const retainedHashes = new Set(references.map((reference) => reference.hash));
      names = await readdir(state.directory);
      let removedTemporaryFiles = 0;
      let removedOrphanBlobs = 0;
      let retainedBlobs = 0;
      let changed = false;
      for (const name of names) {
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
    }
  };
};
