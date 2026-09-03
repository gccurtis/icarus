import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { createConfiguration } from "$model/client/configuration";
import { createDocumentRuntimes } from "$model/client/document-runtimes";
import type { DocumentRuntime, DocumentRuntimesModel } from "$model/client/document-runtimes";

const wire = vi.hoisted(() => {
  const bodyWith = (text: string) => ({
    rows: [
      {
        id: "#r1",
        kind: "blocks",
        blocks: [
          {
            id: "#b1",
            type: "text",
            variant: "paragraph",
            atoms: [{ id: "#a1", kind: "literal", text }],
            display: text,
            marks: []
          }
        ]
      }
    ]
  });

  return { reads: 0, revision: 1, text: "leader", accepts: "leader", bodyWith };
});

vi.mock("$capabilities/document/index.remote", () => ({
  readDocumentBody: () => ({
    ready: true,
    get current() {
      return { revision: wire.revision, body: wire.bodyWith(wire.text) };
    },
    refresh: () => {
      wire.reads += 1;
      return Promise.resolve();
    }
  }),
  submitDocumentChanges: ({ changeSet }: { changeSet: { baseRevision: number } }) => {
    wire.text = wire.accepts;
    wire.revision = changeSet.baseRevision + 1;
    return Promise.resolve({ accepted: true, revision: wire.revision });
  }
}));

const register = (syncEveryMs: number, afterMs = 100_000): DocumentRuntimesModel =>
  createDocumentRuntimes(
    createConfiguration({
      revisions: {
        changeSets: { flushAfterOps: 50, flushAfterMs: afterMs },
        sync: { everyMs: syncEveryMs }
      }
    })
  );

const shows = (runtime: DocumentRuntime): string => {
  const row = runtime.body?.rows[0];
  if (row === undefined || row.kind !== "blocks") return "nothing";

  const block = row.blocks[0];
  return block !== undefined && block.type === "text" ? block.display : "nothing";
};

const set = (row: string, value: number): DocumentOp => ({
  op: "set",
  target: "row",
  path: `rows/#${row}`,
  value,
  was: value - 1
});

beforeEach(() => {
  wire.reads = 0;
  wire.revision = 1;
  wire.text = "leader";
  wire.accepts = "leader";
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

test("opening a document reads the leader", async () => {
  const runtime = register(0).attach("k57");

  await vi.advanceTimersByTimeAsync(0);

  assert.equal(shows(runtime), "leader");
  assert.equal(runtime.revision, 1);
  assert.equal(runtime.sync, "saved");
});

test("opening a tab on a document already open reads it again", async () => {
  const runtimes = register(0);
  const runtime = runtimes.attach("k57");
  await vi.advanceTimersByTimeAsync(0);

  wire.text = "somebody else wrote this";
  const reopened = runtimes.attach("k57");
  await vi.advanceTimersByTimeAsync(0);

  assert.equal(reopened, runtime, "the same runtime, not a second one");
  assert.equal(shows(runtime), "somebody else wrote this");
});

test("a successful flush leaves the runtime holding what the server now has", async () => {
  const runtime = register(0).attach("k57");
  await vi.advanceTimersByTimeAsync(0);

  wire.accepts = "leader, and what was typed";
  runtime.apply([set("r1", 1)]);
  await runtime.flush();
  await vi.advanceTimersByTimeAsync(0);

  assert.equal(shows(runtime), "leader, and what was typed");
  assert.equal(runtime.revision, 2);
});

test("the interval reads again while nothing is outstanding", async () => {
  const runtime = register(100).attach("k57");
  await vi.advanceTimersByTimeAsync(0);

  wire.text = "changed elsewhere";
  await vi.advanceTimersByTimeAsync(100);

  assert.equal(shows(runtime), "changed elsewhere");
});

test("nothing is read while there is work the server has not taken", async () => {
  const runtime = register(100).attach("k57");
  await vi.advanceTimersByTimeAsync(0);

  runtime.apply([set("r1", 1)]);
  const before = wire.reads;
  wire.text = "would overwrite the typing";
  await vi.advanceTimersByTimeAsync(300);

  assert.equal(wire.reads, before, "the interval passed without reading");
  assert.equal(shows(runtime), "leader");
});

test("releasing a document stops its interval", async () => {
  const runtimes = register(100);
  runtimes.attach("k57");
  await vi.advanceTimersByTimeAsync(0);

  runtimes.release("k57");
  const before = wire.reads;
  await vi.advanceTimersByTimeAsync(500);

  assert.equal(wire.reads, before);
});
