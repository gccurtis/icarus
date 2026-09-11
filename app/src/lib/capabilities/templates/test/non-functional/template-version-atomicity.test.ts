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
const { updateTemplate } = await import(
  "$capabilities/templates/api/update-template/update-template"
);

const configuration: Configuration = { get: () => undefined };
const directories: string[] = [];
const storeAt = (
  directory: string,
  failpoint?: (point: StoreFailpoint) => void
): StoreModel => createStore(configuration, directory, failpoint);

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-template-revision-"));
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

const seed = async (directory: string): Promise<string> => {
  runtime.store = storeAt(directory);
  const created = await createTemplate({ target: "document", name: "Plan" });
  if (!created.accepted) throw new Error(created.detail);
  return created.templateId;
};

const rename = (templateId: string) =>
  updateTemplate({
    templateId,
    baseRevision: 1,
    patch: { name: "Revised plan" }
  });

const expectRevisionOne = (store: StoreModel, templateId: string): void => {
  expect(store.read(`templates.${templateId}`)).toMatchObject({
    kind: "row",
    row: { name: "Plan", revision: 1 }
  });
  expect(rowsIn(store, "templateVersions")).toMatchObject([
    { templateId, name: "Plan", revision: 1 }
  ]);
};

const expectRevisionTwo = (store: StoreModel, templateId: string): void => {
  expect(store.read(`templates.${templateId}`)).toMatchObject({
    kind: "row",
    row: { name: "Revised plan", revision: 2 }
  });
  expect(rowsIn(store, "templateVersions")).toMatchObject([
    { templateId, name: "Plan", revision: 1 },
    { templateId, name: "Revised plan", revision: 2 }
  ]);
};

describe("template version atomicity", () => {
  it("advances the live template and immutable history in one commit", async () => {
    const directory = newDirectory();
    const templateId = await seed(directory);
    const touched: string[] = [];
    runtime.store = storeAt(directory, (point) => {
      if (point.startsWith("transaction:after-table:")) {
        touched.push(point.slice("transaction:after-table:".length));
      }
    });

    const answer = await rename(templateId);

    expect(answer).toMatchObject({ accepted: true, templateId, revision: 2 });
    expect([...touched].sort()).toEqual(["templateVersions", "templates"]);
    expectRevisionTwo(storeAt(directory), templateId);
  });

  it("keeps revision one whole when interrupted before the commit decision", async () => {
    const directory = newDirectory();
    const templateId = await seed(directory);
    runtime.store = storeAt(directory, (point) => {
      if (point === "transaction:before-journal") throw new Error("interrupted before journal");
    });

    await expect(rename(templateId)).rejects.toThrow(/interrupted before journal/);

    expectRevisionOne(storeAt(directory), templateId);
  });

  it("recovers revision two whole after every post-commit boundary", async () => {
    const failpoints: StoreFailpoint[] = [
      "transaction:after-journal",
      "transaction:after-table:templateVersions",
      "transaction:after-table:templates",
      "transaction:before-journal-remove"
    ];

    for (const failpoint of failpoints) {
      const directory = newDirectory();
      const templateId = await seed(directory);
      runtime.store = storeAt(directory, (point) => {
        if (point === failpoint) throw new Error(`interrupted at ${point}`);
      });

      await expect(rename(templateId)).rejects.toThrow(/interrupted/);

      expectRevisionTwo(storeAt(directory), templateId);
    }
  });
});
