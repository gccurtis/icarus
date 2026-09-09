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
  const directory = mkdtempSync(join(tmpdir(), "icarus-submit-spreadsheet-"));
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

/** A sheet at revision zero holding one number, and nothing derived from it yet. */
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

/**
 * One submission that reaches every table the intent writes: a formula cell
 * makes a `formulas` row, the address inside it makes a `dataBackReferences`
 * row, and the answer makes a `sheetCells` row.
 */
const writing = (resourceId: string) => ({
  changeSet: {
    resourceId,
    baseRevision: 0,
    ops: [
      {
        op: "set",
        target: "cell",
        path: "r2/c1",
        value: {
          rowId: "r2",
          columnId: "c1",
          value: { kind: "empty" },
          expression: `=\`cell|${resourceId}|r1|c1\`*3`,
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

const revisionOf = (store: StoreModel, leaderId: string): unknown => {
  const found = store.read(`spreadsheetSnapshots.${leaderId}.revision`);
  return found?.kind === "field" ? found.value : undefined;
};

const updatedAtOf = (store: StoreModel, resourceId: string): unknown => {
  const found = store.read(`spreadsheets.${resourceId}.updatedAt`);
  return found?.kind === "field" ? found.value : undefined;
};

/** Nothing the revision is made of moved. */
const expectUntouched = (
  store: StoreModel,
  ids: ReturnType<typeof seeded>
): void => {
  expect(revisionOf(store, ids.leaderId)).toBe(0);
  expect(rowsIn(store, "spreadsheetChangeSets")).toHaveLength(0);
  expect(rowsIn(store, "formulas")).toHaveLength(0);
  expect(rowsIn(store, "dataBackReferences")).toHaveLength(0);
  expect(rowsIn(store, "sheetCells")).toHaveLength(1);
  expect(updatedAtOf(store, ids.resourceId)).toBe(1000);
};

/** Every part of the revision arrived: none of them is readable without the rest. */
const expectAdvanced = (store: StoreModel, ids: ReturnType<typeof seeded>): void => {
  expect(revisionOf(store, ids.leaderId)).toBe(1);

  const changeSets = rowsIn(store, "spreadsheetChangeSets");
  expect(changeSets).toHaveLength(1);
  expect(changeSets[0].revision).toBe(1);

  const cells = rowsIn(store, "sheetCells");
  expect(cells).toHaveLength(2);
  const answer = cells.find((cell) => cell.rowId === "r2");
  expect(answer?.value).toEqual({ kind: "number", value: 12 });

  const formulas = rowsIn(store, "formulas");
  expect(formulas).toHaveLength(1);
  expect(answer?.formulaId).toBe(formulas[0]._id);

  const backReferences = rowsIn(store, "dataBackReferences");
  expect(backReferences).toHaveLength(1);
  expect(backReferences[0].formulaId).toBe(formulas[0]._id);

  expect(updatedAtOf(store, ids.resourceId)).not.toBe(1000);
};

describe("submit spreadsheet changes transaction atomicity", () => {
  it("writes every table of one revision in one commit", async () => {
    const directory = newDirectory();
    const ids = seeded(directory);
    const touched: string[] = [];
    runtime.store = storeAt(directory, (point) => {
      if (point.startsWith("transaction:after-table:")) {
        touched.push(point.slice("transaction:after-table:".length));
      }
    });

    const answer = await submitSpreadsheetChanges(writing(ids.resourceId));

    expect(answer.accepted).toBe(true);
    expect([...touched].sort()).toEqual([
      "dataBackReferences",
      "formulas",
      "sheetCells",
      "spreadsheetChangeSets",
      "spreadsheetSnapshots",
      "spreadsheets"
    ]);
    expectAdvanced(storeAt(directory), ids);
  });

  it("rolls every table back when a failpoint interrupts before the journal", async () => {
    const directory = newDirectory();
    const ids = seeded(directory);
    runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

    await expect(submitSpreadsheetChanges(writing(ids.resourceId))).rejects.toThrow(/interrupted/);

    expectUntouched(storeAt(directory), ids);
  });

  it("recovers the whole revision after every post-commit failpoint", async () => {
    const failpoints: StoreFailpoint[] = [
      "transaction:after-journal",
      "transaction:after-table:dataBackReferences",
      "transaction:after-table:formulas",
      "transaction:after-table:sheetCells",
      "transaction:after-table:spreadsheetChangeSets",
      "transaction:after-table:spreadsheetSnapshots",
      "transaction:after-table:spreadsheets",
      "transaction:before-journal-remove"
    ];

    for (const failpoint of failpoints) {
      const directory = newDirectory();
      const ids = seeded(directory);
      runtime.store = storeAt(directory, interruptAt(failpoint));

      await expect(submitSpreadsheetChanges(writing(ids.resourceId))).rejects.toThrow(/interrupted/);

      expectAdvanced(storeAt(directory), ids);
    }
  });

  it("raises a storage fault rather than reporting it as a refused change set", async () => {
    const directory = newDirectory();
    const ids = seeded(directory);
    runtime.store = storeAt(directory, interruptAt("transaction:before-journal"));

    const answer = await submitSpreadsheetChanges(writing(ids.resourceId)).catch(
      (error: unknown) => error
    );

    expect(answer).toBeInstanceOf(Error);
  });
});
