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

const { submitSpreadsheetChanges } = await import(
  "$capabilities/spreadsheet/api/submit-spreadsheet-changes/submit-spreadsheet-changes"
);

const directories: string[] = [];
const configuration: Configuration = { get: () => undefined };

const storeAt = (directory: string, failpoint?: (point: StoreFailpoint) => void): StoreModel =>
  createStore(configuration, directory, failpoint);

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-spreadsheet-revision-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const body = () => ({
  rows: [
    { id: "r1", order: 0 },
    { id: "r2", order: 1 }
  ],
  columns: [{ id: "c1", order: 0 }],
  rowPartCounts: [2],
  formatRules: [],
  print: {
    page: {
      paper: "letter",
      orientation: "portrait",
      margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }
    }
  },
  styles: { styles: { body: { name: "Body" } }, defaultKey: "body" }
});

const seeded = (directory: string) => {
  const store = storeAt(directory);
  const resourceId = store.create("spreadsheets", {
    projectId: "projects:p",
    title: "Outages",
    createdBy: { kind: "user", userId: "users:u" },
    updatedBy: { kind: "user", userId: "users:u" },
    updatedAt: 1000
  });
  const leaderId = store.create("spreadsheetSnapshots", {
    projectId: "projects:p",
    resourceId,
    revision: 0,
    role: "leader",
    part: 0,
    body: body(),
    at: 1000
  });
  store.create("sheetCells", {
    projectId: "projects:p",
    resourceId,
    rowId: "r1",
    columnId: "c1",
    rowOrder: 0,
    value: { kind: "number", value: 4 }
  });
  return { resourceId, leaderId };
};

const writing = (resourceId: string, baseRevision: number, times: number) => ({
  changeSet: {
    resourceId,
    baseRevision,
    ops: [
      {
        op: "set",
        target: "cell",
        path: "r2/c1",
        value: {
          rowId: "r2",
          columnId: "c1",
          value: { kind: "empty" },
          expression: `=\`cell|${resourceId}|r1|c1\`*${times}`,
          anchors: [""]
        },
        was: null
      }
    ],
    touched: ["r2/c1"]
  }
});

const interruptAt = (target: StoreFailpoint) => (failpoint: StoreFailpoint): void => {
  if (failpoint === target) throw new Error(`interrupted at ${failpoint}`);
};

const rowsIn = (store: StoreModel, table: string): readonly Record<string, unknown>[] => {
  const found = store.read(table);
  return found?.kind === "table" ? (found.rows as readonly Record<string, unknown>[]) : [];
};

const fieldAt = (store: StoreModel, path: string): unknown => {
  const found = store.read(path);
  return found?.kind === "field" ? found.value : undefined;
};

/**
 * What one revision is made of, read back from the tables that hold it.
 *
 * The leader snapshot's revision, the change set that produced it, the answered
 * cell, the formula row behind that answer and the back reference the formula
 * points through are five records of one fact. A reader that finds them
 * disagreeing is reading a sheet nobody ever wrote.
 */
const revisionState = (store: StoreModel, ids: ReturnType<typeof seeded>) => {
  const changeSets = rowsIn(store, "spreadsheetChangeSets");
  const cells = rowsIn(store, "sheetCells");
  const formulas = rowsIn(store, "formulas");
  const backReferences = rowsIn(store, "dataBackReferences");
  const answer = cells.find((cell) => cell.rowId === "r2");

  return {
    leader: fieldAt(store, `spreadsheetSnapshots.${ids.leaderId}.revision`),
    changeSets: changeSets.map((row) => row.revision),
    answer: answer?.value,
    formulaOfAnswer: answer?.formulaId,
    formulas: formulas.map((row) => row._id),
    backReferences: backReferences.map((row) => row.formulaId)
  };
};

describe("spreadsheet revision atomicity", () => {
  it("advances the leader snapshot, the change set, the cells and the formula graph together", async () => {
    const directory = newDirectory();
    const ids = seeded(directory);
    runtime.store = storeAt(directory);

    expect(await submitSpreadsheetChanges(writing(ids.resourceId, 0, 3))).toMatchObject({
      accepted: true,
      revision: 1
    });

    const held = revisionState(storeAt(directory), ids);
    expect(held.leader).toBe(1);
    expect(held.changeSets).toEqual([1]);
    expect(held.answer).toEqual({ kind: "number", value: 12 });
    expect(held.formulas).toHaveLength(1);
    expect(held.formulaOfAnswer).toBe(held.formulas[0]);
    expect(held.backReferences).toEqual([held.formulas[0]]);
  });

  it("keeps them together across a second revision", async () => {
    const directory = newDirectory();
    const ids = seeded(directory);
    runtime.store = storeAt(directory);

    await submitSpreadsheetChanges(writing(ids.resourceId, 0, 3));
    expect(await submitSpreadsheetChanges(writing(ids.resourceId, 1, 5))).toMatchObject({
      accepted: true,
      revision: 2
    });

    const held = revisionState(storeAt(directory), ids);
    expect(held.leader).toBe(2);
    expect(held.changeSets).toEqual([1, 2]);
    expect(held.answer).toEqual({ kind: "number", value: 20 });
    expect(held.formulas).toHaveLength(1);
    expect(held.formulaOfAnswer).toBe(held.formulas[0]);
    expect(held.backReferences).toEqual([held.formulas[0]]);
  });

  it("leaves no half-advanced revision when a failpoint interrupts the commit", async () => {
    const directory = newDirectory();
    const ids = seeded(directory);
    const before = revisionState(storeAt(directory), ids);
    runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

    await expect(submitSpreadsheetChanges(writing(ids.resourceId, 0, 3))).rejects.toThrow(
      /interrupted/
    );

    expect(revisionState(storeAt(directory), ids)).toEqual(before);
    expect(before.leader).toBe(0);
    expect(before.changeSets).toEqual([]);
  });

  it("recovers one whole revision when the interruption lands after the journal", async () => {
    const directory = newDirectory();
    const ids = seeded(directory);
    runtime.store = storeAt(directory, interruptAt("transaction:after-table:formulas"));

    await expect(submitSpreadsheetChanges(writing(ids.resourceId, 0, 3))).rejects.toThrow(
      /interrupted/
    );

    const held = revisionState(storeAt(directory), ids);
    expect(held.leader).toBe(1);
    expect(held.changeSets).toEqual([1]);
    expect(held.answer).toEqual({ kind: "number", value: 12 });
    expect(held.formulaOfAnswer).toBe(held.formulas[0]);
    expect(held.backReferences).toEqual([held.formulas[0]]);
  });
});
