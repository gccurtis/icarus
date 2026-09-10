import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "$model/server/configuration/index.server";
import { createStore, type StoreFailpoint, type StoreModel } from "$model/server/store/index.server";

const runtime = vi.hoisted(() => ({ store: undefined as unknown as StoreModel }));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () =>
    Promise.resolve({ projectId: "projects:p", userId: "users:u", username: "Uma" })
}));

const { submitDocumentChanges } = await import(
  "$capabilities/document/api/submit-document-changes/submit-document-changes"
);

const configuration: Configuration = { get: () => undefined };
const directories: string[] = [];
const storeAt = (directory: string, failpoint?: (point: StoreFailpoint) => void): StoreModel =>
  createStore(configuration, directory, failpoint);
const directory = (): string => {
  const made = mkdtempSync(join(tmpdir(), "icarus-submit-document-"));
  directories.push(made);
  return made;
};

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

const rowsIn = (store: StoreModel, table: string): readonly Record<string, unknown>[] => {
  const found = store.read(table);
  return found?.kind === "table" ? found.rows as readonly Record<string, unknown>[] : [];
};

const seeded = (path: string) => {
  const store = storeAt(path);
  const resourceId = store.create("documents", {
    projectId: "projects:p",
    title: "Plan",
    updatedAt: 1_000,
    createdBy: { kind: "user", userId: "users:u" },
    updatedBy: { kind: "user", userId: "users:u" }
  });
  const leaderId = store.create("documentSnapshots", {
    projectId: "projects:p",
    resourceId,
    revision: 0,
    role: "leader",
    part: 0,
    body: {
      rows: [{
        id: "row:1",
        kind: "blocks",
        blocks: [{
          id: "block:1",
          type: "text",
          variant: "paragraph",
          atoms: [{ id: "atom:1", kind: "literal", text: "Plan" }],
          display: "Plan",
          marks: []
        }]
      }]
    },
    at: 1_000
  });
  return { resourceId, leaderId };
};

const writing = (resourceId: string) => ({
  changeSet: {
    resourceId,
    baseRevision: 0,
    ops: [{
      op: "text",
      target: "atom",
      path: "block:1/atoms/atom:1",
      at: 4,
      insert: " now",
      remove: ""
    }],
    touched: ["block:1/atoms/atom:1"]
  }
});

const insertingUnconfiguredPrompt = (resourceId: string) => ({
  changeSet: {
    resourceId,
    baseRevision: 0,
    ops: [{
      op: "insert",
      target: "row",
      path: "rows",
      ids: ["row:prompt"],
      after: "row:1",
      values: [{
        id: "row:prompt",
        kind: "blocks",
        blocks: [{
          id: "block:prompt",
          type: "prompt",
          style: "body",
          atoms: [{ id: "atom:prompt", kind: "literal", text: "Text" }],
          display: "Text",
          marks: [],
          state: "idle"
        }]
      }]
    }],
    touched: ["rows"]
  }
});

const revisionOf = (store: StoreModel, leaderId: string): unknown => {
  const found = store.read(`documentSnapshots.${leaderId}.revision`);
  return found?.kind === "field" ? found.value : undefined;
};

const expectUntouched = (store: StoreModel, ids: ReturnType<typeof seeded>): void => {
  expect(revisionOf(store, ids.leaderId)).toBe(0);
  expect(rowsIn(store, "documentChangeSets")).toHaveLength(0);
  expect(rowsIn(store, "semanticSyncJobs")).toHaveLength(0);
  expect(rowsIn(store, "semanticMaterialJobs")).toHaveLength(0);
};

const expectAdvanced = (store: StoreModel, ids: ReturnType<typeof seeded>): void => {
  expect(revisionOf(store, ids.leaderId)).toBe(1);
  expect(rowsIn(store, "documentChangeSets")).toHaveLength(1);
  expect(rowsIn(store, "semanticSyncJobs")[0]).toMatchObject({
    ref: { kind: "document", id: ids.resourceId }, requestedRevision: 1, state: "queued"
  });
  expect(rowsIn(store, "semanticMaterialJobs")[0]).toMatchObject({
    ref: { kind: "document", id: ids.resourceId }, requestedRevision: 1, state: "queued"
  });
};

const interruptAt = (target: StoreFailpoint) => (point: StoreFailpoint): void => {
  if (point === target) throw new Error(`interrupted at ${point}`);
};

describe("submit document changes transaction atomicity", () => {
  it("commits revision, snapshot, metadata, and both semantic outbox lanes together", async () => {
    const path = directory();
    const ids = seeded(path);
    const touched: string[] = [];
    runtime.store = storeAt(path, (point) => {
      if (point.startsWith("transaction:after-table:")) {
        touched.push(point.slice("transaction:after-table:".length));
      }
    });

    await expect(submitDocumentChanges(writing(ids.resourceId))).resolves.toMatchObject({
      accepted: true,
      revision: 1
    });
    expect(touched.sort()).toEqual([
      "documentChangeSets",
      "documentSnapshots",
      "documents",
      "semanticMaterialJobs",
      "semanticSyncJobs"
    ]);
    expectAdvanced(storeAt(path), ids);
  });

  it("persists a newly inserted prompt before it has configuration", async () => {
    const path = directory();
    const ids = seeded(path);
    runtime.store = storeAt(path);

    await expect(submitDocumentChanges(insertingUnconfiguredPrompt(ids.resourceId))).resolves.toMatchObject({
      accepted: true,
      revision: 1
    });

    const snapshot = rowsIn(storeAt(path), "documentSnapshots")[0];
    expect(snapshot.body).toMatchObject({
      rows: [
        { id: "row:1" },
        { id: "row:prompt", blocks: [{ id: "block:prompt", type: "prompt", state: "idle" }] }
      ]
    });
  });

  it("detaches a comment when an accepted edit finds no live anchor spans", async () => {
    const path = directory();
    const ids = seeded(path);
    const setup = storeAt(path);
    const threadId = setup.create("commentThreads", {
      projectId: "projects:p",
      target: { kind: "document", id: ids.resourceId },
      within: {
        kind: "text",
        spans: [{
          blockId: "block:gone",
          from: { atom: "atom:gone", offset: 0 },
          to: { atom: "atom:gone", offset: 3 }
        }]
      },
      createdBy: { kind: "user", userId: "users:u" },
      updatedAt: 1_000
    });
    runtime.store = storeAt(path);

    await expect(submitDocumentChanges(writing(ids.resourceId))).resolves.toMatchObject({
      accepted: true,
      revision: 1
    });

    expect(storeAt(path).read(`commentThreads.${threadId}.within`)).toBeUndefined();
  });

  it("rolls back before decision and recovers whole after every decided boundary", async () => {
    const rollbackPath = directory();
    const rollbackIds = seeded(rollbackPath);
    runtime.store = storeAt(rollbackPath, interruptAt("transaction:before-journal"));
    await expect(submitDocumentChanges(writing(rollbackIds.resourceId))).rejects.toThrow(/interrupted/);
    expectUntouched(storeAt(rollbackPath), rollbackIds);

    const failpoints: StoreFailpoint[] = [
      "transaction:after-journal",
      "transaction:after-table:documentChangeSets",
      "transaction:after-table:documentSnapshots",
      "transaction:after-table:documents",
      "transaction:after-table:semanticSyncJobs",
      "transaction:after-table:semanticMaterialJobs",
      "transaction:before-journal-remove"
    ];
    for (const failpoint of failpoints) {
      const path = directory();
      const ids = seeded(path);
      runtime.store = storeAt(path, interruptAt(failpoint));
      await expect(submitDocumentChanges(writing(ids.resourceId))).rejects.toThrow(/interrupted/);
      expectAdvanced(storeAt(path), ids);
    }
  });
});
