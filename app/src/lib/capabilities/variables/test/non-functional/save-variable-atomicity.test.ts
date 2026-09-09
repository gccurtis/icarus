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

const { saveVariable } = await import("$capabilities/variables/api/save-variable/save-variable");

const directories: string[] = [];
const configuration: Configuration = { get: () => undefined };

const storeAt = (directory: string, failpoint?: (point: StoreFailpoint) => void): StoreModel =>
  createStore(configuration, directory, failpoint);

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-save-variable-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A project already holding the name, so the conditional write takes its other branch. */
const seededWith = (directory: string, value: number): string => {
  const store = storeAt(directory);
  return store.create("variables", {
    projectId: "projects:p",
    name: "rate",
    value: { kind: "number", value },
    type: "number",
    createdBy: { kind: "user", userId: "users:u" },
    updatedAt: 1000
  });
};

const asking = { name: "rate", value: { kind: "number", value: 7 }, type: "number" };

const interruptAt = (target: StoreFailpoint) => (failpoint: StoreFailpoint): void => {
  if (failpoint === target) throw new Error(`interrupted at ${failpoint}`);
};

const rows = (store: StoreModel): readonly Record<string, unknown>[] => {
  const found = store.read("variables");
  return found?.kind === "table" ? (found.rows as readonly Record<string, unknown>[]) : [];
};

const POST_COMMIT: StoreFailpoint[] = [
  "transaction:after-journal",
  "transaction:after-table:variables",
  "transaction:before-journal-remove"
];

describe("save variable transaction atomicity", () => {
  it("decides and writes in one commit", async () => {
    const directory = newDirectory();
    const touched: string[] = [];
    runtime.store = storeAt(directory, (point) => {
      if (point.startsWith("transaction:after-table:")) {
        touched.push(point.slice("transaction:after-table:".length));
      }
    });

    const answer = await saveVariable(asking);

    expect(answer.saved).toBe(true);
    expect(touched).toEqual(["variables"]);
    expect(rows(storeAt(directory))).toHaveLength(1);
  });

  it("leaves no row behind when a first save is interrupted before the journal", async () => {
    const directory = newDirectory();
    runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

    await expect(saveVariable(asking)).rejects.toThrow(/interrupted/);

    expect(rows(storeAt(directory))).toHaveLength(0);
  });

  it("leaves the held value when a change is interrupted before the journal", async () => {
    const directory = newDirectory();
    seededWith(directory, 4);
    runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

    await expect(saveVariable(asking)).rejects.toThrow(/interrupted/);

    const held = rows(storeAt(directory));
    expect(held).toHaveLength(1);
    expect(held[0].value).toEqual({ kind: "number", value: 4 });
  });

  it("recovers a first save after every post-commit failpoint", async () => {
    for (const failpoint of POST_COMMIT) {
      const directory = newDirectory();
      runtime.store = storeAt(directory, interruptAt(failpoint));

      await expect(saveVariable(asking)).rejects.toThrow(/interrupted/);

      const held = rows(storeAt(directory));
      expect(held).toHaveLength(1);
      expect(held[0].value).toEqual({ kind: "number", value: 7 });
    }
  });

  it("recovers a change after every post-commit failpoint", async () => {
    for (const failpoint of POST_COMMIT) {
      const directory = newDirectory();
      const id = seededWith(directory, 4);
      runtime.store = storeAt(directory, interruptAt(failpoint));

      await expect(saveVariable(asking)).rejects.toThrow(/interrupted/);

      const held = rows(storeAt(directory));
      expect(held).toHaveLength(1);
      expect(held[0]._id).toBe(id);
      expect(held[0].value).toEqual({ kind: "number", value: 7 });
    }
  });

  it("raises a storage fault rather than reporting it as a refused name", async () => {
    const directory = newDirectory();
    runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

    const answer = await saveVariable(asking).catch((error: unknown) => error);

    expect(answer).toBeInstanceOf(Error);
  });
});
