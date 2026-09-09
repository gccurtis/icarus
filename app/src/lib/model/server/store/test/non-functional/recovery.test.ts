import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { defineStore } from "$model/server/store/constructor";
import { journalPath } from "$model/server/store/methods/transaction/journal.server";
import type { StoreFailpoint } from "$model/server/store/types";

const directories: string[] = [];
const directory = (): string => {
  const created = mkdtempSync(join(tmpdir(), "icarus-store-recovery-"));
  directories.push(created);
  return created;
};

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

const interruptAt = (target: StoreFailpoint) => (failpoint: StoreFailpoint): void => {
  if (failpoint === target) throw new Error(`interrupted at ${failpoint}`);
};

const interruptedTransaction = (path: string, target: StoreFailpoint) => {
  const store = defineStore({ directory: path, now: () => 1000, failpoint: interruptAt(target) });
  let projectId = "";
  let documentId = "";
  expect(() =>
    store.transaction((unit) => {
      projectId = unit.create("projects", { name: "Q3" });
      documentId = unit.create("documents", { projectId, title: "Plan" });
    })
  ).toThrow(/interrupted/);
  return { store, projectId, documentId };
};

describe("transaction failpoint recovery before readiness", () => {
  it("rolls back when interruption happens before the durable commit decision", () => {
    const path = directory();
    const { store } = interruptedTransaction(path, "transaction:before-journal");

    expect(store.read("projects")).toMatchObject({ kind: "table", rows: [] });
    expect(defineStore({ directory: path }).read("documents")).toMatchObject({
      kind: "table",
      rows: []
    });
    expect(existsSync(journalPath(path))).toBe(false);
  });

  it("restarts to one committed result from every post-decision interruption phase", () => {
    const failpoints: StoreFailpoint[] = [
      "transaction:after-journal",
      "transaction:after-table:documents",
      "transaction:after-table:projects",
      "transaction:before-journal-remove"
    ];

    for (const failpoint of failpoints) {
      const path = directory();
      const { store, projectId, documentId } = interruptedTransaction(path, failpoint);
      expect(() => store.read("projects")).toThrow(/must be restarted/);

      const restarted = defineStore({ directory: path });
      expect(restarted.read(`projects.${projectId}`)).toMatchObject({ kind: "row" });
      expect(restarted.read(`documents.${documentId}`)).toMatchObject({ kind: "row" });
      expect(existsSync(journalPath(path))).toBe(false);
    }
  });

  it("withholds readiness when recovery is interrupted and succeeds on the next restart", () => {
    const path = directory();
    const { projectId, documentId } = interruptedTransaction(path, "transaction:after-journal");

    expect(() =>
      defineStore({
        directory: path,
        failpoint: interruptAt("recovery:after-table:documents")
      })
    ).toThrow(/interrupted/);
    expect(existsSync(journalPath(path))).toBe(true);

    const restarted = defineStore({ directory: path });
    expect(restarted.read(`projects.${projectId}`)).toMatchObject({ kind: "row" });
    expect(restarted.read(`documents.${documentId}`)).toMatchObject({ kind: "row" });
    expect(existsSync(journalPath(path))).toBe(false);
  });

  it("discards an uncommitted next-journal before loading tables", () => {
    const path = directory();
    const next = `${journalPath(path)}.next`;
    writeFileSync(
      next,
      JSON.stringify({
        version: 1,
        transactionId: "not-decided",
        state: "committed",
        changes: [{
          table: "projects",
          rows: [{ _id: "projects:uncommitted", _creationTime: 1000, name: "Never" }]
        }]
      })
    );

    expect(defineStore({ directory: path }).read("projects")).toMatchObject({
      kind: "table",
      rows: []
    });
    expect(existsSync(next)).toBe(false);
  });

  it("fails readiness for an unknown journal schema instead of applying legacy recovery", () => {
    const path = directory();
    writeFileSync(
      journalPath(path),
      JSON.stringify({ version: 0, state: "prepared", changes: [] })
    );

    expect(() => defineStore({ directory: path })).toThrow(/unsupported schema/);
    expect(existsSync(journalPath(path))).toBe(true);
  });
});
