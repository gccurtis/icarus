import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "$model/server/configuration/index.server";
import { createStore, type StoreFailpoint, type StoreModel } from "$model/server/store/index.server";
import type { ProjectResourceTarget } from "$capabilities/project-resources/types/project-resources";

const runtime = vi.hoisted(() => ({ store: undefined as unknown as StoreModel }));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () =>
    Promise.resolve({ projectId: "projects:p", userId: "users:u", username: "Uma" })
}));

const { createProjectResource } = await import(
  "$capabilities/project-resources/api/create-project-resource/create-project-resource"
);

const configuration: Configuration = { get: () => undefined };
const directories: string[] = [];
const storeAt = (directory: string, failpoint?: (point: StoreFailpoint) => void): StoreModel =>
  createStore(configuration, directory, failpoint);

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-create-resource-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const subjects = [
  { target: "document", resources: "documents", snapshots: "documentSnapshots", exact: true },
  { target: "presentation", resources: "presentations", snapshots: "presentationSnapshots", exact: true },
  { target: "spreadsheet", resources: "spreadsheets", snapshots: "spreadsheetSnapshots", exact: false }
] as const satisfies readonly {
  target: ProjectResourceTarget;
  resources: string;
  snapshots: string;
  exact: boolean;
}[];

const interruptAt = (target: StoreFailpoint) => (point: StoreFailpoint): void => {
  if (point === target) throw new Error(`interrupted at ${point}`);
};

const rowsIn = (store: StoreModel, table: string): readonly Record<string, unknown>[] => {
  const found = store.read(table);
  return found?.kind === "table" ? (found.rows as readonly Record<string, unknown>[]) : [];
};

const expectWhole = (
  store: StoreModel,
  subject: (typeof subjects)[number]
): void => {
  const resources = rowsIn(store, subject.resources);
  const snapshots = rowsIn(store, subject.snapshots);
  expect(resources).toHaveLength(1);
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0].resourceId).toBe(resources[0]._id);
  expect(snapshots[0]).toMatchObject({ revision: 0, role: "leader", part: 0 });
  const exactJobs = rowsIn(store, "semanticSyncJobs");
  const materialJobs = rowsIn(store, "semanticMaterialJobs");
  expect(exactJobs).toHaveLength(subject.exact ? 1 : 0);
  expect(materialJobs).toHaveLength(1);
  if (subject.exact) expect(exactJobs[0]).toMatchObject({ requestedRevision: 0, state: "queued" });
  expect(materialJobs[0]).toMatchObject({ requestedRevision: 0, state: "queued" });
};

describe("create project resource transaction atomicity", () => {
  for (const subject of subjects) {
    it(`${subject.target} resource and leader snapshot commit together`, async () => {
      const directory = newDirectory();
      const touched: string[] = [];
      runtime.store = storeAt(directory, (point) => {
        if (point.startsWith("transaction:after-table:")) {
          touched.push(point.slice("transaction:after-table:".length));
        }
      });

      await createProjectResource({ target: subject.target, title: "Untitled" });

      expect(touched.sort()).toEqual([
        subject.resources,
        subject.snapshots,
        ...(subject.exact ? ["semanticSyncJobs"] : []),
        "semanticMaterialJobs"
      ].sort());
      expectWhole(storeAt(directory), subject);
    });

    it(`${subject.target} creation rolls back before the commit decision`, async () => {
      const directory = newDirectory();
      runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

      await expect(
        createProjectResource({ target: subject.target, title: "Untitled" })
      ).rejects.toThrow(/interrupted/);

      const restarted = storeAt(directory);
      expect(rowsIn(restarted, subject.resources)).toHaveLength(0);
      expect(rowsIn(restarted, subject.snapshots)).toHaveLength(0);
      expect(rowsIn(restarted, "semanticSyncJobs")).toHaveLength(0);
      expect(rowsIn(restarted, "semanticMaterialJobs")).toHaveLength(0);
    });

    it(`${subject.target} creation recovers whole after every commit boundary`, async () => {
      const failpoints: StoreFailpoint[] = [
        "transaction:after-journal",
        `transaction:after-table:${subject.resources}` as StoreFailpoint,
        `transaction:after-table:${subject.snapshots}` as StoreFailpoint,
        ...(subject.exact
          ? ["transaction:after-table:semanticSyncJobs" as StoreFailpoint]
          : []),
        "transaction:after-table:semanticMaterialJobs",
        "transaction:before-journal-remove"
      ];

      for (const failpoint of failpoints) {
        const directory = newDirectory();
        runtime.store = storeAt(directory, interruptAt(failpoint));

        await expect(
          createProjectResource({ target: subject.target, title: "Untitled" })
        ).rejects.toThrow(/interrupted/);

        expectWhole(storeAt(directory), subject);
      }
    });
  }
});
