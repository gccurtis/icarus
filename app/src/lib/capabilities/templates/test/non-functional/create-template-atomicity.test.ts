import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "$model/server/configuration/index.server";
import {
  createStore,
  type StoreFailpoint,
  type StoreModel
} from "$model/server/store/index.server";

const runtime = vi.hoisted(() => ({ store: undefined as unknown as StoreModel }));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () =>
    Promise.resolve({ projectId: "projects:p", userId: "users:u", username: "Uma" })
}));

const { createTemplate } = await import(
  "$capabilities/templates/api/create-template/create-template"
);

const configuration: Configuration = { get: () => undefined };
const directories: string[] = [];
const storeAt = (
  directory: string,
  failpoint?: (point: StoreFailpoint) => void
): StoreModel => createStore(configuration, directory, failpoint);

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-create-template-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const rowsIn = (store: StoreModel, table: string): readonly Record<string, unknown>[] => {
  const found = store.read(table);
  return found?.kind === "table" ? (found.rows as readonly Record<string, unknown>[]) : [];
};

const expectUntouched = (store: StoreModel): void => {
  expect(rowsIn(store, "templates")).toHaveLength(0);
  expect(rowsIn(store, "templateVersions")).toHaveLength(0);
};

const expectWhole = (store: StoreModel): void => {
  const templates = rowsIn(store, "templates");
  const versions = rowsIn(store, "templateVersions");
  expect(templates).toHaveLength(1);
  expect(versions).toHaveLength(1);
  expect(templates[0]).toMatchObject({
    projectId: "projects:p",
    userId: "users:u",
    name: "Plan",
    revision: 1,
    body: { resource: "document" },
    holes: []
  });
  expect(versions[0]).toMatchObject({
    templateId: templates[0]._id,
    name: "Plan",
    revision: 1,
    body: { resource: "document" },
    holes: []
  });
};

const createPlan = () => createTemplate({ name: "Plan", target: "document" });

describe("create template transaction atomicity", () => {
  it("writes the live template and initial immutable version in one commit", async () => {
    const directory = newDirectory();
    const touched: string[] = [];
    runtime.store = storeAt(directory, (point) => {
      if (point.startsWith("transaction:after-table:")) {
        touched.push(point.slice("transaction:after-table:".length));
      }
    });

    const answer = await createPlan();

    expect(answer.accepted).toBe(true);
    expect([...touched].sort()).toEqual(["templateVersions", "templates"]);
    expectWhole(storeAt(directory));
  });

  it("rolls both rows back when interrupted before the commit decision", async () => {
    const directory = newDirectory();
    runtime.store = storeAt(directory, (point) => {
      if (point === "transaction:before-journal") throw new Error("interrupted before journal");
    });

    await expect(createPlan()).rejects.toThrow(/interrupted before journal/);

    expectUntouched(storeAt(directory));
  });

  it("recovers both rows after every post-commit boundary", async () => {
    const failpoints: StoreFailpoint[] = [
      "transaction:after-journal",
      "transaction:after-table:templateVersions",
      "transaction:after-table:templates",
      "transaction:before-journal-remove"
    ];

    for (const failpoint of failpoints) {
      const directory = newDirectory();
      runtime.store = storeAt(directory, (point) => {
        if (point === failpoint) throw new Error(`interrupted at ${point}`);
      });

      await expect(createPlan()).rejects.toThrow(/interrupted/);

      expectWhole(storeAt(directory));
    }
  });
});
