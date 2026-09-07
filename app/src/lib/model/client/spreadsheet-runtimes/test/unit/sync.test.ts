import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import { createConfiguration } from "$model/client/configuration";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";
import type {
  SpreadsheetRuntime,
  SpreadsheetRuntimesModel
} from "$model/client/spreadsheet-runtimes";

const wire = vi.hoisted(() => {
  const body = {
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
    print: {
      page: {
        paper: "letter",
        orientation: "portrait",
        margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }
      }
    },
    styles: { styles: { body: { name: "Body" } }, defaultKey: "body" }
  };
  const cellsWith = (text: string) => [
    { rowId: "r1", columnId: "c1", value: { kind: "text", value: text } }
  ];

  return { reads: 0, revision: 1, text: "leader", accepts: "leader", body, cellsWith };
});

vi.mock("$capabilities/spreadsheet/index.remote", () => ({
  readSpreadsheet: () => ({
    ready: true,
    get current() {
      return { revision: wire.revision, body: wire.body, cells: wire.cellsWith(wire.text) };
    },
    refresh: () => {
      wire.reads += 1;
      return Promise.resolve();
    }
  }),
  submitSpreadsheetChanges: ({ changeSet }: { changeSet: { baseRevision: number } }) => {
    wire.text = wire.accepts;
    wire.revision = changeSet.baseRevision + 1;
    return Promise.resolve({ accepted: true, revision: wire.revision });
  }
}));

const register = (syncEveryMs: number, afterMs = 100_000): SpreadsheetRuntimesModel =>
  createSpreadsheetRuntimes(
    createConfiguration({
      revisions: {
        changeSets: { flushAfterOps: 50, flushAfterMs: afterMs },
        sync: { everyMs: syncEveryMs }
      }
    })
  );

const shows = (runtime: SpreadsheetRuntime): string => {
  const cell = runtime.sheet?.cells["r1/c1"];
  return cell !== undefined && cell.value.kind === "text" ? cell.value.value : "nothing";
};

const typing = (text: string): SpreadsheetOp => ({
  op: "set",
  target: "cell",
  path: "r1/c1/value",
  value: { kind: "text", value: text },
  was: { kind: "text", value: "leader" }
});

beforeEach(() => {
  wire.reads = 0;
  wire.revision = 1;
  wire.text = "leader";
  wire.accepts = "leader";
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test("opening a sheet reads the leader and keys its cells by coordinate", async () => {
  const runtime = register(0).attach("x9");

  await vi.advanceTimersByTimeAsync(0);

  assert.equal(shows(runtime), "leader");
  assert.equal(runtime.revision, 1);
  assert.equal(runtime.sync, "saved");
});

test("opening a tab on a sheet already open reads it again", async () => {
  const runtimes = register(0);
  const runtime = runtimes.attach("x9");
  await vi.advanceTimersByTimeAsync(0);

  wire.text = "somebody else wrote this";
  const reopened = runtimes.attach("x9");
  await vi.advanceTimersByTimeAsync(0);

  assert.equal(reopened, runtime, "the same runtime, not a second one");
  assert.equal(shows(runtime), "somebody else wrote this");
});

test("an applied op shows in the live sheet before anything is sent", () => {
  const runtime = register(0).attach("x9");

  runtime.apply([typing("typed")]);

  assert.equal(runtime.pending, 1);
});

test("a successful flush leaves the runtime holding what the server now has", async () => {
  const runtime = register(0).attach("x9");
  await vi.advanceTimersByTimeAsync(0);

  runtime.apply([typing("typed")]);
  assert.equal(shows(runtime), "typed");

  wire.accepts = "typed, as the server kept it";
  await runtime.flush();
  await vi.advanceTimersByTimeAsync(0);

  assert.equal(shows(runtime), "typed, as the server kept it");
  assert.equal(runtime.revision, 2);
});

test("the interval reads again while nothing is outstanding", async () => {
  const runtime = register(100).attach("x9");
  await vi.advanceTimersByTimeAsync(0);

  wire.text = "changed elsewhere";
  await vi.advanceTimersByTimeAsync(100);

  assert.equal(shows(runtime), "changed elsewhere");
});

test("nothing is read while there is work the server has not taken", async () => {
  const runtime = register(100).attach("x9");
  await vi.advanceTimersByTimeAsync(0);

  runtime.apply([typing("typed")]);
  const before = wire.reads;
  wire.text = "would overwrite the typing";
  await vi.advanceTimersByTimeAsync(300);

  assert.equal(wire.reads, before, "the interval passed without reading");
  assert.equal(shows(runtime), "typed");
});

test("releasing a sheet stops its interval", async () => {
  const runtimes = register(100);
  runtimes.attach("x9");
  await vi.advanceTimersByTimeAsync(0);

  runtimes.release("x9");
  const before = wire.reads;
  await vi.advanceTimersByTimeAsync(500);

  assert.equal(wire.reads, before);
});
