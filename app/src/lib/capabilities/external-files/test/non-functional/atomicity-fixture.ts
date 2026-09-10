import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineExternalFileStorage } from "$model/server/external-file-storage/index.server";
import {
  createStore,
  type StoreFailpoint,
  type StoreModel
} from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import type { FileSubkind } from "$representation/data/types/external/file";
import { enqueueSemanticOutboxFor } from "$capabilities/semantic-overlay";

export const atomicScope = {
  projectId: asId<"projects">("projects:atomic"),
  userId: "users:atomic",
  username: "Atomic User"
};

const configuration = {
  get: (key: string): unknown => ({
    "externalFiles.upload.maxFiles": 50,
    "externalFiles.upload.maxFileBytes": 5_000_000,
    "externalFiles.upload.maxBatchBytes": 20_000_000,
    "externalFiles.upload.maxPathBytes": 512,
    "externalFiles.download.maxResponseBytes": 5_000_000
  })[key]
};

const temporary = new Set<string>();

export type AtomicFixture = {
  readonly root: string;
  readonly storeDirectory: string;
  readonly storageDirectory: string;
  readonly model: ServerModel;
  readonly ids: readonly string[];
  readonly hashes: readonly string[];
  readonly materialIds: readonly string[];
};

export const EXISTING_EXTERNAL_MUTATION_TABLES = [
  "activity",
  "externalFiles",
  "semanticMaterialHistory",
  "semanticMaterialJobs",
  "semanticMaterials",
  "semanticObjects"
] as const;

export const rowsIn = (
  store: StoreModel,
  table: string
): readonly Record<string, unknown>[] => {
  const found = store.read(table);
  return found?.kind === "table" ? found.rows as unknown as readonly Record<string, unknown>[] : [];
};

const modelAt = (
  storeDirectory: string,
  storageDirectory: string,
  failpoint?: (point: StoreFailpoint) => void
): ServerModel => ({
  store: createStore(configuration, storeDirectory, failpoint),
  externalFileStorage: defineExternalFileStorage(storageDirectory),
  configuration
} as unknown as ServerModel);

const profileFor = (subkind: FileSubkind, index: number) => {
  if (subkind === "data") return {
    name: `file-${index}.csv`,
    mediaType: "text/csv",
    bytes: new TextEncoder().encode(`name,value\nrow-${index},${index}\n`)
  };
  if (subkind === "text") return {
    name: `file-${index}.md`,
    mediaType: "text/markdown",
    bytes: new TextEncoder().encode(`# File ${index}\n\nCurrent prose.`)
  };
  return {
    name: `file-${index}.ts`,
    mediaType: "text/typescript",
    bytes: new TextEncoder().encode(`export const value${index} = ${index};\n`)
  };
};

export const makeAtomicFixture = async (
  count = 1,
  subkind: FileSubkind = "code"
): Promise<AtomicFixture> => {
  const root = await mkdtemp(join(tmpdir(), "icarus-external-atomicity-"));
  temporary.add(root);
  const storeDirectory = join(root, "store");
  const storageDirectory = join(root, "native");
  const model = modelAt(storeDirectory, storageDirectory);
  const ids: string[] = [];
  const hashes: string[] = [];
  const materialIds: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    const profile = profileFor(subkind, index);
    const hash = createHash("sha256").update(profile.bytes).digest("hex");
    hashes.push(hash);
    const receipt = await model.externalFileStorage.put({
      storageId: asId<"_storage">(`_storage:${hash}`),
      hash,
      size: profile.bytes.byteLength,
      bytes: profile.bytes,
      maxBytes: profile.bytes.byteLength
    });
    const relativePath = count > 1
      ? `source/group-${index}/${profile.name}`
      : profile.name;
    const id = model.store.create("externalFiles", {
      projectId: atomicScope.projectId,
      name: profile.name,
      originalName: profile.name,
      relativePath,
      mediaType: profile.mediaType,
      subkind,
      storageId: `_storage:${hash}`,
      hash,
      size: profile.bytes.byteLength,
      origin: { kind: "upload" },
      createdBy: { kind: "user", userId: atomicScope.userId },
      updatedBy: { kind: "user", userId: atomicScope.userId },
      revision: 1,
      updatedAt: 1
    });
    ids.push(id);
    await model.externalFileStorage.claimPublication(receipt, id);
    const ref = { kind: `externalFile::${subkind}`, id };
    const material = {
      projectId: atomicScope.projectId,
      identityKey: `fixture:${id}`,
      kind: subkind === "data" ? "csv" : "code",
      name: profile.name,
      source: {
        kind: "externalFile",
        ref,
        fileId: id,
        hash,
        mediaType: profile.mediaType,
        subkind
      },
      profile: subkind === "data"
        ? {
            kind: "csv", delimiter: ",", encoding: "utf-8", rows: 2, columns: 2,
            headers: ["name", "value"], columnsProfile: [], sample: [], sampledRows: 2,
            malformedRows: 0, truncated: false, warnings: []
          }
        : {
            kind: "code", language: "typescript", lines: 1, imports: [], exports: [],
            symbols: [], parser: "bounded-regex", truncated: false, warnings: []
          },
      profileHash: `profile:${hash}`,
      contextHash: `context:${hash}`,
      revisionKey: `hash:${hash}`,
      state: "ready",
      updatedAt: 1
    } as const;
    const materialId = model.store.create("semanticMaterials", material);
    materialIds.push(materialId);
    model.store.create("semanticMaterialHistory", {
      projectId: atomicScope.projectId,
      retiredGeneration: 1,
      material,
      retiredAt: 1
    });
    model.store.create("semanticObjects", {
      projectId: atomicScope.projectId,
      lane: "material",
      semanticMaterialId: materialId,
      facet: "profile",
      inputHash: `facet:${hash}`,
      vector: [1, 0]
    });
    model.store.transaction((unit) => {
      enqueueSemanticOutboxFor(
        model,
        unit,
        atomicScope.projectId,
        { kind: `externalFile::${subkind}`, id },
        1
      );
    });
  }
  return { root, storeDirectory, storageDirectory, model, ids, hashes, materialIds };
};

export const restartAtomicFixture = (
  fixture: AtomicFixture,
  failpoint?: (point: StoreFailpoint) => void
): ServerModel => modelAt(fixture.storeDirectory, fixture.storageDirectory, failpoint);

/** Mirrors runtime startup: Store recovery completes before native reconciliation. */
export const recoverAtomicFixture = async (
  fixture: AtomicFixture
): Promise<ServerModel> => {
  const model = restartAtomicFixture(fixture);
  await model.externalFileStorage.reconcile(rowsIn(model.store, "externalFiles").map((row) => ({
    ownerId: asId<"externalFiles">(row._id as string),
    storageId: asId<"_storage">(row.storageId as string),
    hash: row.hash as string,
    size: row.size as number
  })));
  return model;
};

export const interruptAt = (target: StoreFailpoint) => (point: StoreFailpoint): void => {
  if (point === target) throw new Error(`interrupted at failpoint ${point}`);
};

export const cleanupAtomicFixtures = async (): Promise<void> => {
  await Promise.all([...temporary].map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
  temporary.clear();
};
