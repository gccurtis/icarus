import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  tables: new Map<string, Row[]>(),
  writes: [] as { path: string; value: unknown }[],
  removals: [] as string[],
  store: {
    create: (table: string, fields: Record<string, unknown>) => {
      const rows = model.tables.get(table) ?? [];
      const id = `${table}:${rows.length + 1}`;
      model.tables.set(table, [...rows, { ...fields, _id: id }]);
      return id;
    },
    read: (path: string) => ({ table: path, kind: "table", rows: model.tables.get(path) ?? [] }),
    update: (path: string, value: unknown) => {
      model.writes.push({ path, value });
    },
    remove: (path: string) => {
      model.removals.push(path);
    }
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: "p", userId: "users:1", username: "You" })
}));

const { startThread } = await import("$capabilities/comments/api/start-thread/start-thread");
const { reply } = await import("$capabilities/comments/api/reply/reply");
const { resolveThread } = await import("$capabilities/comments/api/resolve-thread/resolve-thread");
const { validateStartThread } = await import("$capabilities/comments/api/start-thread/validate-start-thread");

beforeEach(() => {
  model.tables = new Map();
  model.writes = [];
  model.removals = [];
});

describe("startThread", () => {
  it("files a thread and its first comment under the asking user and project", async () => {
    const made = await startThread({
      target: { kind: "slides", id: "slideDecks:1" },
      within: { kind: "element", elementId: "el-5" },
      text: "  Is this the right feeder?  "
    });

    const thread = model.tables.get("commentThreads")?.[0];
    const comment = model.tables.get("comments")?.[0];
    assert.equal(made.threadId, thread?._id);
    assert.equal(made.commentId, comment?._id);
    assert.equal(thread?.projectId, "p");
    assert.deepEqual(thread?.createdBy, { kind: "user", userId: "users:1" });
    assert.deepEqual(thread?.within, { kind: "element", elementId: "el-5" });
    assert.equal(comment?.threadId, thread?._id);
    assert.equal((comment?.blocks as { display: string }[])[0].display, "Is this the right feeder?");
  });

  it("refuses an empty remark and an unknown anchor", () => {
    assert.throws(() => validateStartThread({ target: { kind: "slides", id: "slideDecks:1" }, text: "  " }));
    assert.throws(() => validateStartThread({ target: { kind: "slides", id: "slideDecks:1" }, within: { kind: "page" }, text: "x" }));
    assert.throws(() => validateStartThread({ target: { kind: "photo", id: "x" }, text: "x" }));
  });
});

describe("reply and resolve", () => {
  it("replies only into a thread of the asking project", async () => {
    model.tables.set("commentThreads", [
      { _id: "commentThreads:1", projectId: "p", target: { kind: "slides", id: "slideDecks:1" } },
      { _id: "commentThreads:2", projectId: "other", target: { kind: "slides", id: "slideDecks:2" } }
    ]);

    const made = await reply({ threadId: "commentThreads:1", text: "Yes." });
    assert.equal(model.tables.get("comments")?.[0]._id, made.commentId);
    assert.equal(model.writes[0]?.path, "commentThreads.commentThreads:1.updatedAt");

    await assert.rejects(reply({ threadId: "commentThreads:2", text: "No." }));
  });

  it("settles a thread with who did it, and reopens by removing that", async () => {
    model.tables.set("commentThreads", [
      { _id: "commentThreads:1", projectId: "p", target: { kind: "slides", id: "slideDecks:1" }, resolution: { by: "users:2", at: 1 } }
    ]);

    await resolveThread({ threadId: "commentThreads:1", resolved: true });
    const written = model.writes.find((write) => write.path.endsWith(".resolution"));
    assert.equal((written?.value as { by: string }).by, "users:1");

    await resolveThread({ threadId: "commentThreads:1", resolved: false });
    assert.deepEqual(model.removals, ["commentThreads.commentThreads:1.resolution"]);
  });
});
