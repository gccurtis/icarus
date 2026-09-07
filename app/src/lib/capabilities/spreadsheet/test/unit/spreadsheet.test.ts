import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  calls: [] as string[],
  snapshots: [] as Row[],
  changeSets: [] as Row[],
  cells: [] as Row[],
  variables: [] as Row[],
  formulas: [] as Row[],
  backReferences: [] as Row[],
  minted: 0,
  tableOf(path: string): Row[] {
    const table = path.split(".")[0];
    if (table === "spreadsheetChangeSets") return model.changeSets;
    if (table === "sheetCells") return model.cells;
    if (table === "variables") return model.variables;
    if (table === "formulas") return model.formulas;
    if (table === "dataBackReferences") return model.backReferences;
    return model.snapshots;
  },
  store: {
    create: (table: string, fields: unknown) => {
      model.calls.push(`create ${table}`);
      model.minted += 1;
      const id = `${table}:${model.minted}`;
      model.tableOf(table).push({ ...(fields as Row), _id: id });
      return id;
    },
    read: (path: string) => {
      model.calls.push(`read ${path}`);
      const table = path.split(".")[0];
      return { table, kind: "table", rows: model.tableOf(path) };
    },
    update: (path: string, value: unknown) => {
      model.calls.push(`update ${path}`);
      const [, id] = path.split(".");
      const rows = model.tableOf(path);
      const at = rows.findIndex((row) => row._id === id);
      if (at !== -1) rows[at] = { ...(value as Row), _id: id };
    },
    remove: (path: string) => {
      model.calls.push(`remove ${path}`);
      const [, id] = path.split(".");
      const rows = model.tableOf(path);
      const at = rows.findIndex((row) => row._id === id);
      if (at !== -1) rows.splice(at, 1);
    }
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: "p", userId: "u", username: "You" })
}));

const { readSpreadsheet } = await import(
  "$capabilities/spreadsheet/api/read-spreadsheet/read-spreadsheet"
);
const { submitSpreadsheetChanges } = await import(
  "$capabilities/spreadsheet/api/submit-spreadsheet-changes/submit-spreadsheet-changes"
);

const body = () => ({
  rows: [
    { id: "r1", order: 1 },
    { id: "r2", order: 2 }
  ],
  columns: [
    { id: "c1", order: 1 },
    { id: "c2", order: 2 }
  ],
  rowPartCounts: [2],
  formatRules: [],
  print: { page: { paper: "letter", orientation: "portrait", margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } } },
  styles: { styles: { body: { name: "Body" } }, defaultKey: "body" }
});

const leaderAt = (revision: number) =>
  model.snapshots.push({
    _id: "spreadsheetSnapshots:1",
    projectId: "p",
    resourceId: "spreadsheets:1",
    role: "leader",
    revision,
    part: 0,
    body: body(),
    at: 1
  });

const cellRow = (rowId: string, columnId: string, value: unknown) =>
  model.cells.push({
    _id: `sheetCells:${model.cells.length + 100}`,
    projectId: "p",
    resourceId: "spreadsheets:1",
    rowId,
    columnId,
    rowOrder: Number(rowId.slice(1)),
    value
  });

const sending = (baseRevision: number, ops: unknown[]) => ({
  changeSet: {
    resourceId: "spreadsheets:1",
    baseRevision,
    ops,
    touched: [...new Set(ops.map((op) => (op as { path: string }).path))]
  }
});

const typing = (baseRevision: number, path: string, value: number, was: unknown = null) =>
  sending(baseRevision, [
    { op: "set", target: "cell", path, value: { kind: "number", value }, was }
  ]);

beforeEach(() => {
  model.calls.length = 0;
  model.snapshots.length = 0;
  model.changeSets.length = 0;
  model.cells.length = 0;
  model.variables.length = 0;
  model.formulas.length = 0;
  model.backReferences.length = 0;
  model.minted = 0;
});

test("a sheet with no leader reads as nothing", async () => {
  assert.equal(await readSpreadsheet({ resourceId: "spreadsheets:1" }), null);
});

test("a read without a resourceId is refused", async () => {
  await assert.rejects(() => readSpreadsheet({}), /resourceId is required/);
});

test("a read answers the leader body and the sheet's cells without their row fields", async () => {
  leaderAt(3);
  cellRow("r1", "c1", { kind: "text", value: "Feeder" });
  model.cells.push({
    _id: "sheetCells:9",
    projectId: "other",
    resourceId: "spreadsheets:1",
    rowId: "r1",
    columnId: "c2",
    rowOrder: 1,
    value: { kind: "text", value: "elsewhere" }
  });

  const found = await readSpreadsheet({ resourceId: "spreadsheets:1" });

  assert.equal(found?.revision, 3);
  assert.deepEqual(found?.cells, [{ rowId: "r1", columnId: "c1", value: { kind: "text", value: "Feeder" } }]);
});

test("the first change set on an unwritten sheet mints the leader from the empty grid", async () => {
  const accepted = await submitSpreadsheetChanges(typing(0, "r3/c2/value", 42));

  assert.deepEqual(accepted, { accepted: true, revision: 1 });
  assert.equal(model.snapshots.length, 1);
  assert.equal(model.snapshots[0].revision, 1);
  assert.equal(model.cells.length, 1);
  assert.equal(model.cells[0].rowId, "r3");
  assert.equal(model.cells[0].rowOrder, 3);
});

test("a set on a coordinate makes a cell row, and a second set updates it", async () => {
  leaderAt(0);

  await submitSpreadsheetChanges(typing(0, "r2/c1/value", 12));
  assert.equal(model.cells.length, 1);
  assert.deepEqual(model.cells[0].value, { kind: "number", value: 12 });
  assert.equal(model.cells[0].rowOrder, 2);

  await submitSpreadsheetChanges(typing(1, "r2/c1/value", 13, { kind: "number", value: 12 }));
  assert.equal(model.cells.length, 1);
  assert.deepEqual(model.cells[0].value, { kind: "number", value: 13 });
  assert.equal(model.calls.filter((call) => call === "create sheetCells").length, 1);
});

test("clearing a coordinate removes its row", async () => {
  leaderAt(0);
  cellRow("r2", "c1", { kind: "number", value: 12 });

  const accepted = await submitSpreadsheetChanges(
    sending(0, [{ op: "set", target: "cell", path: "r2/c1", value: null, was: { rowId: "r2", columnId: "c1", value: { kind: "number", value: 12 } } }])
  );

  assert.equal(accepted.accepted, true);
  assert.equal(model.cells.length, 0);
  assert.ok(model.calls.includes("remove sheetCells.sheetCells:100"));
});

test("removing a row removes its cells and inserting one touches none", async () => {
  leaderAt(0);
  cellRow("r2", "c1", { kind: "number", value: 12 });

  await submitSpreadsheetChanges(
    sending(0, [{ op: "insert", target: "gridRow", path: "rows", ids: ["r9"], after: "r1", values: [{ id: "r9", order: 1.5 }] }])
  );
  assert.equal(model.cells.length, 1);
  assert.equal((model.snapshots[0].body as { rows: { id: string }[] }).rows.map((row) => row.id).join(","), "r1,r9,r2");

  await submitSpreadsheetChanges(
    sending(1, [{ op: "remove", target: "gridRow", path: "rows", ids: ["r2"], after: "r9", values: [{ id: "r2", order: 2 }] }])
  );
  assert.equal(model.cells.length, 0);
});

test("moving a row rewrites the sort key on its cells", async () => {
  leaderAt(0);
  cellRow("r2", "c1", { kind: "number", value: 12 });

  await submitSpreadsheetChanges(
    sending(0, [{ op: "move", target: "gridRow", path: "rows", id: "r2", after: null, wasAfter: "r1" }])
  );

  assert.equal(model.cells[0].rowOrder, 0);
  assert.ok(model.calls.includes("update sheetCells.sheetCells:100"));
});

test("every accepted change set is written and the revisions ascend", async () => {
  leaderAt(0);

  await submitSpreadsheetChanges(typing(0, "r1/c1/value", 1));
  await submitSpreadsheetChanges(typing(1, "r1/c2/value", 2));

  assert.deepEqual(
    model.changeSets.map((set) => [set.revision, set.baseRevision, set.tier]),
    [
      [1, 0, "recent"],
      [2, 1, "recent"]
    ]
  );
  assert.equal(model.snapshots.length, 1);
  assert.equal(model.snapshots[0].revision, 2);
});

test("a change set authored against an older revision is refused when the changes since cannot be read", async () => {
  leaderAt(4);

  assert.deepEqual(await submitSpreadsheetChanges(typing(2, "r1/c1/value", 1)), {
    accepted: false,
    reason: "stale",
    revision: 4,
    detail: "authored against revision 2, the leader is at 4"
  });
  assert.equal(model.changeSets.length, 0);
});

test("two people in one cell are stale; two people in two cells catch up", async () => {
  leaderAt(0);
  await submitSpreadsheetChanges(typing(0, "r1/c1/value", 1));

  const clash = await submitSpreadsheetChanges(typing(0, "r1/c1/value", 2));
  assert.equal(clash.accepted, false);
  assert.equal(clash.accepted === false && clash.reason, "stale");

  const apart = await submitSpreadsheetChanges(typing(0, "r2/c2/value", 3));
  assert.deepEqual(apart, {
    accepted: true,
    revision: 2,
    catchUp: [{ op: "set", target: "cell", path: "r1/c1/value", value: { kind: "number", value: 1 }, was: null }]
  });
});

test("a change set whose ops do not resolve writes nothing", async () => {
  leaderAt(0);

  const refused = await submitSpreadsheetChanges(typing(0, "r9/c1/value", 1));

  assert.equal(refused.accepted, false);
  assert.equal(refused.accepted === false && refused.reason, "unresolved");
  assert.match(refused.accepted === false ? refused.detail : "", /no row r9/);
  assert.equal(model.changeSets.length, 0);
  assert.equal(model.cells.length, 0);
});

test("an empty change set is refused before anything is read", async () => {
  await assert.rejects(() => submitSpreadsheetChanges(sending(0, [])), /at least one op/);
});

test("an accepted change set marks the spreadsheet updated", async () => {
  leaderAt(0);

  await submitSpreadsheetChanges(typing(0, "r1/c1/value", 1));

  assert.ok(model.calls.includes("update spreadsheets.spreadsheets:1.updatedAt"));
});
