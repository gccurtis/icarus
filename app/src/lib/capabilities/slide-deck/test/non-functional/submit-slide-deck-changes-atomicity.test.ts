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

const { submitSlideDeckChanges } = await import(
  "$capabilities/slide-deck/api/submit-slide-deck-changes/submit-slide-deck-changes"
);

const configuration: Configuration = { get: () => undefined };
const directories: string[] = [];
const storeAt = (directory: string, failpoint?: (point: StoreFailpoint) => void): StoreModel =>
  createStore(configuration, directory, failpoint);
const directory = (): string => {
  const made = mkdtempSync(join(tmpdir(), "icarus-submit-deck-"));
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
  const resourceId = store.create("slideDecks", {
    projectId: "projects:p",
    title: "Briefing",
    updatedAt: 1_000,
    createdBy: { kind: "user", userId: "users:u" },
    updatedBy: { kind: "user", userId: "users:u" }
  });
  const leaderId = store.create("slideDeckSnapshots", {
    projectId: "projects:p",
    resourceId,
    revision: 0,
    role: "leader",
    part: 0,
    body: {
      aspectRatio: "16:9",
      theme: { colors: { text: "ink", accent: "blue", muted: "gray" } },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [],
      slides: [{ id: "slide:1", elements: [], notes: [] }],
      sections: []
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
      op: "set",
      path: "theme/colors/accent",
      value: "violet",
      was: "blue"
    }],
    touched: ["theme/colors/accent"]
  }
});

const revisionOf = (store: StoreModel, leaderId: string): unknown => {
  const found = store.read(`slideDeckSnapshots.${leaderId}.revision`);
  return found?.kind === "field" ? found.value : undefined;
};

const expectUntouched = (store: StoreModel, ids: ReturnType<typeof seeded>): void => {
  expect(revisionOf(store, ids.leaderId)).toBe(0);
  expect(rowsIn(store, "slideDeckChangeSets")).toHaveLength(0);
  expect(rowsIn(store, "semanticSyncJobs")).toHaveLength(0);
  expect(rowsIn(store, "semanticMaterialJobs")).toHaveLength(0);
};

const expectAdvanced = (store: StoreModel, ids: ReturnType<typeof seeded>): void => {
  expect(revisionOf(store, ids.leaderId)).toBe(1);
  expect(rowsIn(store, "slideDeckChangeSets")).toHaveLength(1);
  expect(rowsIn(store, "semanticSyncJobs")[0]).toMatchObject({
    ref: { kind: "slides", id: ids.resourceId }, requestedRevision: 1, state: "queued"
  });
  expect(rowsIn(store, "semanticMaterialJobs")[0]).toMatchObject({
    ref: { kind: "slides", id: ids.resourceId }, requestedRevision: 1, state: "queued"
  });
};

const interruptAt = (target: StoreFailpoint) => (point: StoreFailpoint): void => {
  if (point === target) throw new Error(`interrupted at ${point}`);
};

describe("submit slide-deck changes transaction atomicity", () => {
  it("commits revision, snapshot, metadata, and both semantic outbox lanes together", async () => {
    const path = directory();
    const ids = seeded(path);
    const touched: string[] = [];
    runtime.store = storeAt(path, (point) => {
      if (point.startsWith("transaction:after-table:")) {
        touched.push(point.slice("transaction:after-table:".length));
      }
    });

    await expect(submitSlideDeckChanges(writing(ids.resourceId))).resolves.toMatchObject({
      accepted: true,
      revision: 1
    });
    expect(touched.sort()).toEqual([
      "semanticMaterialJobs",
      "semanticSyncJobs",
      "slideDeckChangeSets",
      "slideDeckSnapshots",
      "slideDecks"
    ]);
    expectAdvanced(storeAt(path), ids);
  });

  it("rolls back before decision and recovers whole after every decided boundary", async () => {
    const rollbackPath = directory();
    const rollbackIds = seeded(rollbackPath);
    runtime.store = storeAt(rollbackPath, interruptAt("transaction:before-journal"));
    await expect(submitSlideDeckChanges(writing(rollbackIds.resourceId))).rejects.toThrow(/interrupted/);
    expectUntouched(storeAt(rollbackPath), rollbackIds);

    const failpoints: StoreFailpoint[] = [
      "transaction:after-journal",
      "transaction:after-table:slideDeckChangeSets",
      "transaction:after-table:slideDeckSnapshots",
      "transaction:after-table:slideDecks",
      "transaction:after-table:semanticSyncJobs",
      "transaction:after-table:semanticMaterialJobs",
      "transaction:before-journal-remove"
    ];
    for (const failpoint of failpoints) {
      const path = directory();
      const ids = seeded(path);
      runtime.store = storeAt(path, interruptAt(failpoint));
      await expect(submitSlideDeckChanges(writing(ids.resourceId))).rejects.toThrow(/interrupted/);
      expectAdvanced(storeAt(path), ids);
    }
  });
});
