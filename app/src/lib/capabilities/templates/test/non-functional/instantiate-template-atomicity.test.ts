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

const { instantiateTemplate } = await import(
  "$capabilities/templates/api/instantiate-template/instantiate-template"
);

const configuration: Configuration = { get: () => undefined };
const directories: string[] = [];
const storeAt = (directory: string, failpoint?: (point: StoreFailpoint) => void): StoreModel =>
  createStore(configuration, directory, failpoint);

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-instantiate-template-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const subjects = [
  {
    target: "document",
    resources: "documents",
    snapshots: "documentSnapshots",
    exact: true,
    body: { resource: "document", rows: [] }
  },
  {
    target: "slides",
    resources: "slideDecks",
    snapshots: "slideDeckSnapshots",
    exact: true,
    body: {
      resource: "slides",
      aspectRatio: "16:9",
      theme: { colors: { text: "ink", accent: "blue", muted: "gray" } },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [],
      slides: [],
      sections: []
    }
  },
  {
    target: "spreadsheet",
    resources: "spreadsheets",
    snapshots: "spreadsheetSnapshots",
    exact: false,
    body: {
      resource: "spreadsheet",
      cells: { A1: { value: { kind: "text", value: "Ready" } } },
      formatRules: [],
      print: {
        page: {
          paper: "letter",
          orientation: "portrait",
          margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }
        }
      },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } }
    }
  }
] as const;

const seeded = (directory: string, subject: (typeof subjects)[number]) => {
  const store = storeAt(directory);
  const templateId = store.create("templates", {
    projectId: "projects:p",
    userId: "users:u",
    name: "Plan",
    tags: [],
    body: subject.body,
    holes: [],
    createdBy: { kind: "user", userId: "users:u" },
    revision: 2,
    updatedAt: 1000
  });
  return templateId;
};

const interruptAt = (target: StoreFailpoint) => (point: StoreFailpoint): void => {
  if (point === target) throw new Error(`interrupted at ${point}`);
};

const rowsIn = (store: StoreModel, table: string): readonly Record<string, unknown>[] => {
  const found = store.read(table);
  return found?.kind === "table" ? (found.rows as readonly Record<string, unknown>[]) : [];
};

const expectWhole = (
  store: StoreModel,
  subject: (typeof subjects)[number],
  templateId: string
): void => {
  const resources = rowsIn(store, subject.resources);
  const snapshots = rowsIn(store, subject.snapshots);
  expect(resources).toHaveLength(1);
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0].resourceId).toBe(resources[0]._id);
  expect(snapshots[0]).toMatchObject({ revision: 0, role: "leader", part: 0 });
  expect(rowsIn(store, "semanticSyncJobs")).toHaveLength(subject.exact ? 1 : 0);
  expect(rowsIn(store, "semanticMaterialJobs")).toHaveLength(1);
  expect(rowsIn(store, "sheetCells")).toHaveLength(subject.target === "spreadsheet" ? 1 : 0);
  const lastUsedAt = store.read(`templates.${templateId}.lastUsedAt`);
  expect(lastUsedAt?.kind === "field" ? lastUsedAt.value : undefined).toBeTypeOf("number");
};

describe("instantiate template transaction atomicity", () => {
  for (const subject of subjects) {
    it(`${subject.target} instantiation rolls back before the commit decision`, async () => {
      const directory = newDirectory();
      const templateId = seeded(directory, subject);
      runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

      await expect(instantiateTemplate({ templateId })).rejects.toThrow(/interrupted/);

      const restarted = storeAt(directory);
      expect(rowsIn(restarted, subject.resources)).toHaveLength(0);
      expect(rowsIn(restarted, subject.snapshots)).toHaveLength(0);
      expect(rowsIn(restarted, "semanticSyncJobs")).toHaveLength(0);
      expect(rowsIn(restarted, "semanticMaterialJobs")).toHaveLength(0);
      expect(rowsIn(restarted, "sheetCells")).toHaveLength(0);
      expect(restarted.read(`templates.${templateId}.lastUsedAt`)).toBeUndefined();
    });

    it(`${subject.target} instantiation recovers whole after every commit boundary`, async () => {
      const failpoints: StoreFailpoint[] = [
        "transaction:after-journal",
        `transaction:after-table:${subject.resources}` as StoreFailpoint,
        `transaction:after-table:${subject.snapshots}` as StoreFailpoint,
        ...(subject.exact
          ? ["transaction:after-table:semanticSyncJobs" as StoreFailpoint]
          : []),
        "transaction:after-table:semanticMaterialJobs",
        ...(subject.target === "spreadsheet"
          ? ["transaction:after-table:sheetCells" as StoreFailpoint]
          : []),
        "transaction:after-table:templates",
        "transaction:before-journal-remove"
      ];

      for (const failpoint of failpoints) {
        const directory = newDirectory();
        const templateId = seeded(directory, subject);
        runtime.store = storeAt(directory, interruptAt(failpoint));

        await expect(instantiateTemplate({ templateId })).rejects.toThrow(/interrupted/);

        expectWhole(storeAt(directory), subject, templateId);
      }
    });
  }
});
