import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import {
  ContextConflictError,
  ContextValidationError,
  SQLiteContextStore,
  StaleContextError,
  createContextManager,
  type ContextManager
} from "../../src/3-capabilities/context/index.js";
import { registerContextEndpoints } from "../../src/4-job-wiring/context/registerContextEndpoints.js";
import { CapturingLogger } from "../helpers/testDoubles.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "../../src/0-utils/persistence/resourceHistory.js";

let fixtureSequence = 0;

const createFixture = (config: { maxEntriesPerContext?: number } = {}): ContextManager => {
  // A distinct project id per fixture keeps the hashed table prefix distinct, so
  // suites sharing a temp directory never observe each other's rows.
  const projectId = `context-test-project-${(fixtureSequence += 1)}`;
  const directory = mkdtempSync(join(tmpdir(), "icarus-context-"));
  const store = new SQLiteContextStore(projectId, join(directory, "contexts.db"));
  return createContextManager(
    store,
    { maxEntriesPerContext: config.maxEntriesPerContext ?? 1000, maxResolveDepth: 10 },
    new CapturingLogger()
  );
};

test("a private context is hidden from list by default and revealed by includePrivate", async () => {
  const ctx = createFixture();
  await ctx.declare("Visible", [{ id: "doc-1", kind: "document" }]);
  const hidden = await ctx.declare("Hidden", [{ id: "doc-2", kind: "document" }], {
    private: true
  });

  const listed = await ctx.list();
  assert.deepEqual(listed.map((record) => record.displayName), ["Visible"]);

  const listedWithPrivate = await ctx.list({ includePrivate: true });
  assert.deepEqual(
    listedWithPrivate.map((record) => record.displayName).sort(),
    ["Hidden", "Visible"]
  );

  // A private record is still directly addressable — the flag is list visibility only.
  assert.equal((await ctx.get(hidden.id))?.displayName, "Hidden");
  assert.equal((await ctx.getByName("Hidden"))?.id, hidden.id);
});

test("declare defaults private to false", async () => {
  const ctx = createFixture();
  const record = await ctx.declare("Plain", [{ id: "doc-1", kind: "document" }]);
  assert.equal(record.private, false);
  assert.equal((await ctx.get(record.id))?.private, false);
});

test("composeNamed persists union and difference results under the caller's name", async () => {
  const ctx = createFixture();
  const a = await ctx.declare("A", [
    { id: "doc-1", kind: "document" },
    { id: "doc-2", kind: "document" }
  ]);
  const b = await ctx.declare("B", [{ id: "doc-2", kind: "document" }]);

  const union = await ctx.composeNamed("union", { contextId: a.id }, { contextId: b.id }, "A or B");
  assert.equal(union.displayName, "A or B");
  assert.deepEqual(union.entries.map((entry) => entry.id), ["doc-1", "doc-2"]);

  const difference = await ctx.composeNamed(
    "difference",
    { contextId: a.id },
    { entries: [{ id: "doc-2", kind: "document" }] },
    "A without B",
    { private: true }
  );
  assert.deepEqual(difference.entries.map((entry) => entry.id), ["doc-1"]);
  assert.equal(difference.private, true);

  // Both results are real, addressable records rather than transient values.
  assert.equal((await ctx.get(union.id))?.entries.length, 2);
  assert.equal((await ctx.get(difference.id))?.entries.length, 1);
});

test("update increments the revision and rejects a stale expected revision", async () => {
  const ctx = createFixture();
  const record = await ctx.declare("Scope", [{ id: "doc-1", kind: "document" }]);
  assert.equal(record.revision, 1);

  const updated = await ctx.update(record.id, [{ id: "doc-9", kind: "document" }], 1);
  assert.equal(updated.revision, 2);
  assert.deepEqual(updated.entries.map((entry) => entry.id), ["doc-9"]);

  await assert.rejects(
    () => ctx.update(record.id, [{ id: "doc-3", kind: "document" }], 1),
    StaleContextError
  );
});

test("logical deletion moves Context revisions to history and purge removes them", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-context-history-"));
  const store = new SQLiteContextStore("context-history-project", join(directory, "contexts.db"));
  const ctx = createContextManager(
    store,
    { maxEntriesPerContext: 1000, maxResolveDepth: 10 },
    new CapturingLogger()
  );
  const created = await ctx.declare("History", [{ id: "doc-1", kind: "document" }]);
  const updated = await ctx.update(
    created.id,
    [{ id: "doc-2", kind: "document" }],
    created.revision
  );

  assert.equal(updated.revision, 2);
  assert.deepEqual(store.history(created.id).map((record) => [record.revision, record.recordType]), [
    [1, "snapshot"]
  ]);
  await assert.rejects(() => ctx.purge(created.id), ResourceNotDeletedError);

  await ctx.delete(created.id);
  assert.equal(await ctx.get(created.id), null);
  assert.equal(await ctx.getByName("History"), null);
  assert.deepEqual(await ctx.list({ includePrivate: true }), []);
  assert.deepEqual(await ctx.resolve([{ id: created.id, kind: "context" }]), []);
  assert.deepEqual(store.history(created.id).map((record) => [record.revision, record.recordType]), [
    [1, "snapshot"],
    [2, "snapshot"],
    [3, "deleted"]
  ]);

  await ctx.purge(created.id);
  assert.deepEqual(store.history(created.id), []);
  await assert.rejects(() => ctx.purge(created.id), ResourceHistoryNotFoundError);
});

test("a duplicate live display name is rejected by declare and composeNamed", async () => {
  const ctx = createFixture();
  await ctx.declare("Taken", [{ id: "doc-1", kind: "document" }]);

  await assert.rejects(
    () => ctx.declare("Taken", [{ id: "doc-2", kind: "document" }]),
    ContextConflictError
  );
  await assert.rejects(
    () =>
      ctx.composeNamed(
        "union",
        { entries: [{ id: "doc-1", kind: "document" }] },
        { entries: [{ id: "doc-2", kind: "document" }] },
        "Taken"
      ),
    ContextConflictError
  );
});

test("resolve expands nested contexts once and terminates on a cycle", async () => {
  const ctx = createFixture();
  const inner = await ctx.declare("Inner", [
    { id: "doc-1", kind: "document" },
    { id: "doc-2", kind: "document" }
  ]);
  const outer = await ctx.declare("Outer", [
    { id: "doc-3", kind: "document" },
    { id: inner.id, kind: "context" }
  ]);

  const resolved = await ctx.resolve([{ id: outer.id, kind: "context" }]);
  assert.deepEqual(resolved.map((entry) => entry.id), ["doc-3", "doc-1", "doc-2"]);

  // Point Inner back at Outer so the pair forms a cycle, then resolve again.
  await ctx.update(
    inner.id,
    [
      { id: "doc-1", kind: "document" },
      { id: outer.id, kind: "context" }
    ],
    inner.revision
  );

  const cyclic = await ctx.resolve([{ id: outer.id, kind: "context" }]);
  assert.deepEqual(cyclic.map((entry) => entry.id), ["doc-3", "doc-1"]);
});

test("the private flag is only set by a literal boolean true on the wire", async () => {
  const registry = new JobRegistry();
  const declared: { displayName: string; isPrivate: boolean }[] = [];
  const ctx = {
    declare: async (
      displayName: string,
      _entries: unknown,
      options?: { private?: boolean }
    ) => {
      declared.push({ displayName, isPrivate: options?.private ?? false });
      return { id: "ctx-1", displayName, entries: [], private: options?.private ?? false };
    }
  } as unknown as ContextManager;
  registerContextEndpoints(registry, ctx);

  const declareWith = async (privateValue: unknown, displayName: string): Promise<void> => {
    const job = registry.createJob({
      requestId: `request-${displayName}`,
      method: "POST",
      path: "/contexts",
      params: {},
      query: {},
      headers: {},
      body: { displayName, entries: [], private: privateValue }
    });
    assert.equal(job.responseMode, "inline");
    if (job.responseMode !== "inline") return;
    await job.work();
  };

  await declareWith(true, "literal-true");
  await declareWith("true", "string-true");
  await declareWith(1, "number-one");
  await declareWith(undefined, "omitted");

  assert.deepEqual(declared, [
    { displayName: "literal-true", isPrivate: true },
    { displayName: "string-true", isPrivate: false },
    { displayName: "number-one", isPrivate: false },
    { displayName: "omitted", isPrivate: false }
  ]);
});

test("declare and update reject entry arrays over maxEntriesPerContext with a typed error", async () => {
  const ctx = createFixture({ maxEntriesPerContext: 2 });
  const tooMany = [
    { id: "doc-1", kind: "document" },
    { id: "doc-2", kind: "document" },
    { id: "doc-3", kind: "document" }
  ];

  await assert.rejects(
    () => ctx.declare("Over", tooMany),
    (error: unknown) => {
      assert.ok(error instanceof ContextValidationError);
      assert.equal(error.field, "entries");
      return true;
    }
  );

  const record = await ctx.declare("Under", [{ id: "doc-1", kind: "document" }]);
  await assert.rejects(
    () => ctx.update(record.id, tooMany, record.revision),
    (error: unknown) => {
      assert.ok(error instanceof ContextValidationError);
      assert.equal(error.field, "entries");
      return true;
    }
  );
});

test("composeNamed rejects an empty displayName and a combined result over maxEntriesPerContext", async () => {
  const ctx = createFixture({ maxEntriesPerContext: 2 });
  const a = await ctx.declare("A", [
    { id: "doc-1", kind: "document" },
    { id: "doc-2", kind: "document" }
  ]);
  const b = await ctx.declare("B", [{ id: "doc-3", kind: "document" }]);

  await assert.rejects(
    () => ctx.composeNamed("union", { contextId: a.id }, { contextId: b.id }, "   "),
    (error: unknown) => {
      assert.ok(error instanceof ContextValidationError);
      assert.equal(error.field, "displayName");
      return true;
    }
  );

  await assert.rejects(
    () => ctx.composeNamed("union", { contextId: a.id }, { contextId: b.id }, "A or B"),
    (error: unknown) => {
      assert.ok(error instanceof ContextValidationError);
      assert.equal(error.field, "entries");
      return true;
    }
  );
});

test("registerContextEndpoints maps ContextValidationError to 400 context_invalid", async () => {
  const registry = new JobRegistry();
  const ctx = {
    declare: async () => {
      throw new ContextValidationError("entries", "count 3 exceeds maxEntriesPerContext (2)");
    }
  } as unknown as ContextManager;
  registerContextEndpoints(registry, ctx);

  const job = registry.createJob({
    requestId: "request-invalid",
    method: "POST",
    path: "/contexts",
    params: {},
    query: {},
    headers: {},
    body: { displayName: "Over", entries: [] }
  });
  assert.equal(job.responseMode, "inline");
  if (job.responseMode !== "inline") return;
  const result = await job.work();
  assert.deepEqual(result, {
    statusCode: 400,
    body: { error: "context_invalid", message: "entries: count 3 exceeds maxEntriesPerContext (2)", field: "entries" }
  });
});
