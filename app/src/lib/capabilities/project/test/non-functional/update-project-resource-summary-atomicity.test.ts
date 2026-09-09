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

const { updateProjectResourceSummary } = await import(
  "$capabilities/project/api/update-project-resource-summary/update-project-resource-summary"
);

const configuration: Configuration = { get: () => undefined };
const directories: string[] = [];
const storeAt = (directory: string, failpoint?: (point: StoreFailpoint) => void): StoreModel =>
  createStore(configuration, directory, failpoint);

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-project-summary-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const seed = (directory: string): string =>
  storeAt(directory).create("documents", {
    projectId: "projects:p",
    title: "Brief",
    createdBy: { kind: "user", userId: "users:owner" },
    updatedBy: { kind: "user", userId: "users:owner" },
    updatedAt: 10
  });

const documentIn = (directory: string): Record<string, unknown> => {
  const found = storeAt(directory).read("documents");
  if (found?.kind !== "table" || found.rows.length !== 1) {
    throw new Error("expected one represented document");
  }
  return found.rows[0] as Record<string, unknown>;
};

const interruptAt = (target: StoreFailpoint) => (point: StoreFailpoint): void => {
  if (point === target) throw new Error(`interrupted at ${point}`);
};

const expectCommitted = (directory: string): void => {
  expect(documentIn(directory)).toMatchObject({
    summary: "Executive context",
    updatedBy: { kind: "user", userId: "users:u" }
  });
  expect(documentIn(directory).updatedAt).not.toBe(10);
};

describe("update project resource summary transaction failpoints", () => {
  it("commits summary, timestamp, and author through one table boundary", async () => {
    const directory = newDirectory();
    seed(directory);
    const touched: string[] = [];
    runtime.store = storeAt(directory, (point) => {
      if (point.startsWith("transaction:after-table:")) touched.push(point);
    });

    await updateProjectResourceSummary({
      resourceId: documentIn(directory)._id,
      summary: "Executive context"
    });

    expect(touched).toEqual(["transaction:after-table:documents"]);
    expectCommitted(directory);
  });

  it("rolls every field back when interrupted before the journal", async () => {
    const directory = newDirectory();
    const resourceId = seed(directory);
    runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

    await expect(
      updateProjectResourceSummary({ resourceId, summary: "Executive context" })
    ).rejects.toThrow(/interrupted/);

    expect(documentIn(directory)).toMatchObject({
      updatedAt: 10,
      updatedBy: { kind: "user", userId: "users:owner" }
    });
    expect(documentIn(directory)).not.toHaveProperty("summary");
  });

  it("recovers every field after each durable commit boundary", async () => {
    const failpoints: StoreFailpoint[] = [
      "transaction:after-journal",
      "transaction:after-table:documents",
      "transaction:before-journal-remove"
    ];

    for (const failpoint of failpoints) {
      const directory = newDirectory();
      const resourceId = seed(directory);
      runtime.store = storeAt(directory, interruptAt(failpoint));

      await expect(
        updateProjectResourceSummary({ resourceId, summary: "Executive context" })
      ).rejects.toThrow(/interrupted/);

      expectCommitted(directory);
    }
  });
});
