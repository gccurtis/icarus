import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "$model/server/configuration/index.server";
import { createStore, type StoreFailpoint, type StoreModel } from "$model/server/store/index.server";

const runtime = vi.hoisted(() => ({ store: undefined as unknown as StoreModel }));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: "projects:p", userId: "users:u", username: "Uma" })
}));

const { removeTemplate } = await import(
  "$capabilities/templates/api/remove-template/remove-template"
);

const directories: string[] = [];
const configuration: Configuration = { get: () => undefined };
const storeAt = (
  directory: string,
  failpoint?: (point: StoreFailpoint) => void
): StoreModel => createStore(configuration, directory, failpoint);

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-remove-template-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const seeded = (directory: string) => {
  const store = storeAt(directory);
  const templateId = store.create("templates", {
    projectId: "projects:p",
    userId: "users:u",
    name: "Plan",
    tags: [],
    body: { resource: "document", rows: [] },
    slots: [],
    createdBy: { kind: "user", userId: "users:u" },
    revision: 2,
    updatedAt: 1000
  });
  const versionId = store.create("templateVersions", {
    templateId,
    revision: 2,
    name: "Plan",
    tags: [],
    body: { resource: "document", rows: [] },
    slots: [],
    at: 1000
  });
  return { templateId, versionId };
};

const interruptAt = (target: StoreFailpoint) => (failpoint: StoreFailpoint): void => {
  if (failpoint === target) throw new Error(`interrupted at ${failpoint}`);
};

describe("remove template transaction atomicity", () => {
  it("rolls back every table when a failpoint interrupts before commit", async () => {
    const directory = newDirectory();
    const ids = seeded(directory);
    runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

    await expect(
      removeTemplate({ templateId: ids.templateId, baseRevision: 2 })
    ).rejects.toThrow(/interrupted/);

    const restarted = storeAt(directory);
    expect(restarted.read(`templates.${ids.templateId}`)).toMatchObject({ kind: "row" });
    expect(restarted.read(`templateVersions.${ids.versionId}`)).toMatchObject({ kind: "row" });
  });

  it("recovers the complete removal after every post-commit failpoint", async () => {
    const failpoints: StoreFailpoint[] = [
      "transaction:after-journal",
      "transaction:after-table:templateVersions",
      "transaction:after-table:templates",
      "transaction:before-journal-remove"
    ];

    for (const failpoint of failpoints) {
      const directory = newDirectory();
      const ids = seeded(directory);
      runtime.store = storeAt(directory, interruptAt(failpoint));

      await expect(
        removeTemplate({ templateId: ids.templateId, baseRevision: 2 })
      ).rejects.toThrow(/interrupted/);

      const restarted = storeAt(directory);
      expect(restarted.read(`templates.${ids.templateId}`)).toBeUndefined();
      expect(restarted.read(`templateVersions.${ids.versionId}`)).toBeUndefined();
    }
  });
});
