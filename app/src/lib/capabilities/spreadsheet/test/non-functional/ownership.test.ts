import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

import type { StoreUnitOfWork } from "$model/server/store/index.server";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  snapshots: [] as Row[],
  changeSets: [] as Row[],
  cells: [] as Row[],
  sheets: [] as Row[],
  variables: [] as Row[],
  formulas: [] as Row[],
  backReferences: [] as Row[],
  semanticMaterialJobs: [] as Row[],
  minted: 0,
  tableOf(path: string): Row[] {
    const table = path.split(".")[0];
    if (table === "spreadsheetChangeSets") return model.changeSets;
    if (table === "sheetCells") return model.cells;
    if (table === "spreadsheets") return model.sheets;
    if (table === "variables") return model.variables;
    if (table === "formulas") return model.formulas;
    if (table === "dataBackReferences") return model.backReferences;
    if (table === "semanticMaterialJobs") return model.semanticMaterialJobs;
    return model.snapshots;
  },
  store: {
    create: (table: string, fields: unknown) => {
      model.minted += 1;
      const id = `${table}:${model.minted}`;
      model.tableOf(table).push({ ...(fields as Row), _id: id });
      return id;
    },
    read: (path: string) => ({ table: path.split(".")[0], kind: "table", rows: model.tableOf(path) }),
    update: (path: string, value: unknown) => {
      const [, id, field] = path.split(".");
      const rows = model.tableOf(path);
      const at = rows.findIndex((row) => row._id === id);
      if (at === -1) return;
      rows[at] = field === undefined ? { ...(value as Row), _id: id } : { ...rows[at], [field]: value };
    },
    remove: (path: string) => {
      const [, id] = path.split(".");
      const rows = model.tableOf(path);
      const at = rows.findIndex((row) => row._id === id);
      if (at !== -1) rows.splice(at, 1);
    },
    removeRows: (table: string, ids: readonly string[]) => {
      const rows = model.tableOf(table);
      const removed = new Set(ids);
      for (let at = rows.length - 1; at >= 0; at -= 1) {
        if (removed.has(rows[at]._id)) rows.splice(at, 1);
      }
    },
    removeFieldFromRows: (table: string, ids: readonly string[], field: string) => {
      const rows = model.tableOf(table);
      const changed = new Set(ids);
      for (const row of rows) {
        if (changed.has(row._id)) delete row[field];
      }
    },
    transaction: <T>(work: (unit: StoreUnitOfWork) => T): T =>
      work(model.store as unknown as StoreUnitOfWork)
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({
    projectId: "projects:mine",
    userId: "users:u",
    username: "You"
  })
}));

const { submitSpreadsheetChanges } = await import(
  "$capabilities/spreadsheet/api/submit-spreadsheet-changes/submit-spreadsheet-changes"
);

const body = () => ({
  rows: [{ id: "r1", order: 1 }],
  columns: [{ id: "c1", order: 1 }],
  rowPartCounts: [1],
  formatRules: [],
  print: {
    page: { paper: "letter", orientation: "portrait", margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } }
  },
  styles: { styles: { body: { name: "Body" } }, defaultKey: "body" }
});

/** A sheet somebody owns, with the leader snapshot a change set is measured against. */
const sheetOwnedBy = (projectId: string) => {
  model.sheets.push({ _id: "spreadsheets:1", projectId, title: "Sheet" });
  model.snapshots.push({
    _id: "spreadsheetSnapshots:1",
    _creationTime: 1,
    projectId,
    resourceId: "spreadsheets:1",
    role: "leader",
    revision: 0,
    part: 0,
    body: body(),
    at: 1
  });
};

const writing = () => ({
  changeSet: {
    resourceId: "spreadsheets:1",
    baseRevision: 0,
    ops: [{ op: "set", target: "cell", path: "r1/c1/value", value: { kind: "number", value: 7 }, was: null }],
    touched: ["r1/c1/value"]
  }
});

beforeEach(() => {
  model.snapshots.length = 0;
  model.changeSets.length = 0;
  model.cells.length = 0;
  model.sheets.length = 0;
  model.variables.length = 0;
  model.formulas.length = 0;
  model.backReferences.length = 0;
  model.semanticMaterialJobs.length = 0;
  model.minted = 0;
});

/**
 * The contract: submitSpreadsheetChanges acts inside the asking scope's project
 * and nowhere else. A resource id is a guess anyone can make, so ownership is
 * proved against the store rather than taken from the request.
 */
test("submitSpreadsheetChanges refuses a cross-project sheet and writes nothing", async () => {
  sheetOwnedBy("projects:theirs");

  const answer = await submitSpreadsheetChanges(writing());

  assert.equal(answer.accepted, false);
  assert.equal(answer.accepted === false ? answer.reason : "", "missing");
  assert.equal(model.cells.length, 0);
  assert.equal(model.changeSets.length, 0);
  assert.equal(model.snapshots.length, 1);
});

test("submitSpreadsheetChanges accepts the same change on a sheet the scope owns", async () => {
  sheetOwnedBy("projects:mine");

  const answer = await submitSpreadsheetChanges(writing());

  assert.equal(answer.accepted, true, JSON.stringify(answer));
  assert.equal(model.cells.length, 1);
  assert.equal(model.changeSets.length, 1);
  assert.equal(model.semanticMaterialJobs.length, 1);
});

test("submitSpreadsheetChanges refuses a sheet id that names no row at all", async () => {
  const answer = await submitSpreadsheetChanges(writing());

  assert.equal(answer.accepted, false);
  assert.equal(answer.accepted === false ? answer.reason : "", "missing");
  assert.equal(model.changeSets.length, 0);
});
