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

test("composeNamed persists a rule, not a snapshot, and resolves to the composed set", async () => {
  const ctx = createFixture();
  const a = await ctx.declare("A", [
    { id: "doc-1", kind: "document" },
    { id: "doc-2", kind: "document" }
  ]);
  const b = await ctx.declare("B", [{ id: "doc-2", kind: "document" }]);

  const union = await ctx.composeNamed("union", { contextId: a.id }, { contextId: b.id }, "A or B");
  assert.equal(union.displayName, "A or B");
  // References, not copies. This is what keeps the composition live.
  assert.deepEqual(union.entries, [
    { id: a.id, kind: "context" },
    { id: b.id, kind: "context" }
  ]);
  assert.deepEqual(
    (await ctx.resolve([{ id: union.id, kind: "context" }])).map((entry) => entry.id).sort(),
    ["doc-1", "doc-2"]
  );

  const difference = await ctx.composeNamed(
    "difference",
    { contextId: a.id },
    { entries: [{ id: "doc-2", kind: "document" }] },
    "A without B",
    { private: true }
  );
  // The right operand becomes an exclusion rather than being subtracted now.
  assert.deepEqual(difference.entries, [{ id: a.id, kind: "context" }]);
  assert.deepEqual(difference.excludes, [{ id: "doc-2", kind: "document" }]);
  assert.equal(difference.private, true);
  assert.deepEqual(
    (await ctx.resolve([{ id: difference.id, kind: "context" }])).map((entry) => entry.id),
    ["doc-1"]
  );

  // The point of the whole exercise: A grows, and both compositions grow with
  // it. A materialised result would still be answering with yesterday's set.
  await ctx.update(a.id, [
    { id: "doc-1", kind: "document" },
    { id: "doc-2", kind: "document" },
    { id: "doc-3", kind: "document" }
  ], a.revision);

  assert.deepEqual(
    (await ctx.resolve([{ id: union.id, kind: "context" }])).map((entry) => entry.id).sort(),
    ["doc-1", "doc-2", "doc-3"]
  );
  assert.deepEqual(
    (await ctx.resolve([{ id: difference.id, kind: "context" }])).map((entry) => entry.id).sort(),
    ["doc-1", "doc-3"],
    "the exclusion still holds, and the addition still lands"
  );

  // Both results are real, addressable records rather than transient values.
  assert.ok(await ctx.get(union.id));
  assert.ok(await ctx.get(difference.id));
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

test("composeNamed rejects an empty displayName and an operand list over maxEntriesPerContext", async () => {
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

  // A union of two context references stores two entries, which is within the
  // limit even though their expansion is not. The limit bounds what the record
  // holds; it cannot bound a resolve-time expansion, and pretending otherwise
  // was only possible while composition materialised its result.
  const union = await ctx.composeNamed("union", { contextId: a.id }, { contextId: b.id }, "A or B");
  assert.equal(union.entries.length, 2);

  // Inline operands are stored verbatim, so those the limit still catches.
  await assert.rejects(
    () => ctx.composeNamed(
      "union",
      { entries: [
        { id: "doc-4", kind: "document" },
        { id: "doc-5", kind: "document" },
        { id: "doc-6", kind: "document" }
      ] },
      { entries: [] },
      "Too many"
    ),
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

// ─── Live project scope and exclusions ───────────────────────────────────────

const PROJECT = { id: "*", kind: "project" };

test("a project entry expands to the live membership, and tracks it", async () => {
  const ctx = createFixture();
  let membership = [
    { id: "file-1", kind: "general::file::markdown" },
    { id: "conn-1", kind: "connector::directory::local" }
  ];
  ctx.setProjectMembership({ listProjectEntries: async () => membership });

  assert.deepEqual(
    (await ctx.resolve([PROJECT])).map((entry) => entry.id).sort(),
    ["conn-1", "file-1"]
  );

  // The whole point: the record said "the project", not "these two things".
  membership = [...membership, { id: "file-2", kind: "general::file::markdown" }];
  assert.deepEqual(
    (await ctx.resolve([PROJECT])).map((entry) => entry.id).sort(),
    ["conn-1", "file-1", "file-2"]
  );
});

test("a stored context can name the project, less named resources", async () => {
  const ctx = createFixture();
  let membership = [
    { id: "file-1", kind: "general::file::markdown" },
    { id: "file-2", kind: "general::file::markdown" },
    { id: "file-3", kind: "general::file::markdown" }
  ];
  ctx.setProjectMembership({ listProjectEntries: async () => membership });

  const record = await ctx.declare("Everything but two", [PROJECT], {
    excludes: [
      { id: "file-2", kind: "general::file::markdown" },
      // Deliberately the *wrong* kind spelling for the same resource. An
      // exclusion that only matched on kind:id would silently fail to subtract
      // this, which is the failure mode that leaks what someone excluded.
      { id: "file-3", kind: "general-file" }
    ]
  });

  assert.deepEqual(
    (await ctx.resolve([{ id: record.id, kind: "context" }])).map((entry) => entry.id),
    ["file-1"]
  );

  // Still live on the include side, and the exclusions still hold.
  membership = [...membership, { id: "file-4", kind: "general::file::markdown" }];
  assert.deepEqual(
    (await ctx.resolve([{ id: record.id, kind: "context" }])).map((entry) => entry.id).sort(),
    ["file-1", "file-4"]
  );
});

test("an exclusion naming a context subtracts that context's current contents", async () => {
  const ctx = createFixture();
  const secret = await ctx.declare("Secret", [{ id: "doc-2", kind: "document" }]);
  const all = await ctx.declare("All", [
    { id: "doc-1", kind: "document" },
    { id: "doc-2", kind: "document" },
    { id: "doc-3", kind: "document" }
  ]);
  const visible = await ctx.declare("Visible", [{ id: all.id, kind: "context" }], {
    excludes: [{ id: secret.id, kind: "context" }]
  });

  assert.deepEqual(
    (await ctx.resolve([{ id: visible.id, kind: "context" }])).map((entry) => entry.id).sort(),
    ["doc-1", "doc-3"]
  );

  // Adding to the excluded context removes more, without touching Visible.
  await ctx.update(secret.id, [
    { id: "doc-2", kind: "document" },
    { id: "doc-3", kind: "document" }
  ], secret.revision);
  assert.deepEqual(
    (await ctx.resolve([{ id: visible.id, kind: "context" }])).map((entry) => entry.id),
    ["doc-1"]
  );
});

test("with no membership port a project entry resolves to nothing, not everything", async () => {
  const ctx = createFixture();
  // Failing open would silently ground a caller on the whole corpus. Failing
  // closed produces an empty result they can actually see.
  assert.deepEqual(await ctx.resolve([PROJECT]), []);
});

test("a membership port that throws resolves to nothing, not everything", async () => {
  const ctx = createFixture();
  ctx.setProjectMembership({
    listProjectEntries: async () => { throw new Error("enumeration failed"); }
  });
  assert.deepEqual(await ctx.resolve([PROJECT]), []);
});

test("a context reached by two routes resolves identically on both", async () => {
  // The regression the per-record exclusion model could have introduced: a
  // global "already seen, skip" cycle guard would hand the second route an
  // empty set instead of the same one.
  const ctx = createFixture();
  const leaf = await ctx.declare("Leaf", [{ id: "doc-1", kind: "document" }]);
  const left = await ctx.declare("Left", [{ id: leaf.id, kind: "context" }]);
  const right = await ctx.declare("Right", [{ id: leaf.id, kind: "context" }]);

  assert.deepEqual(
    (await ctx.resolve([
      { id: left.id, kind: "context" },
      { id: right.id, kind: "context" }
    ])).map((entry) => entry.id),
    ["doc-1"]
  );

  // And a diamond where one arm excludes: the other arm must be unaffected.
  const filtered = await ctx.declare("Filtered", [{ id: leaf.id, kind: "context" }], {
    excludes: [{ id: "doc-1", kind: "document" }]
  });
  assert.deepEqual(await ctx.resolve([{ id: filtered.id, kind: "context" }]), []);
  assert.deepEqual(
    (await ctx.resolve([
      { id: filtered.id, kind: "context" },
      { id: right.id, kind: "context" }
    ])).map((entry) => entry.id),
    ["doc-1"],
    "Filtered excluding it does not remove it from Right"
  );
});

test("a cycle through excludes terminates, and withholds rather than leaks", async () => {
  const ctx = createFixture();
  const a = await ctx.declare("Cycle A", [{ id: "doc-1", kind: "document" }]);
  const b = await ctx.declare("Cycle B", [{ id: a.id, kind: "context" }]);
  // A now points back at B, through its exclusion list.
  await ctx.update(a.id, [{ id: "doc-1", kind: "document" }], a.revision, {
    excludes: [{ id: b.id, kind: "context" }]
  });

  // It terminates — and A resolves to nothing rather than to doc-1. The cycle
  // means we cannot tell what A was supposed to keep out, and on an exclusion
  // "we don't know" has to mean "keep it out", not "let it through".
  assert.deepEqual(await ctx.resolve([{ id: b.id, kind: "context" }]), []);
  assert.deepEqual(await ctx.resolve([{ id: a.id, kind: "context" }]), []);
});

test("excludes round-trip through the store and update replaces them only when supplied", async () => {
  const ctx = createFixture();
  const record = await ctx.declare("Scoped", [{ id: "doc-1", kind: "document" }], {
    excludes: [{ id: "doc-2", kind: "document" }]
  });
  assert.deepEqual((await ctx.get(record.id))?.excludes, [{ id: "doc-2", kind: "document" }]);

  // Omitted: left alone. Replacing entries says nothing about exclusions, and
  // reading silence as "clear them" would quietly widen the scope.
  const kept = await ctx.update(record.id, [{ id: "doc-9", kind: "document" }], 1);
  assert.deepEqual(kept.excludes, [{ id: "doc-2", kind: "document" }]);
  assert.deepEqual((await ctx.get(record.id))?.excludes, [{ id: "doc-2", kind: "document" }]);

  // Explicitly empty: cleared.
  const cleared = await ctx.update(record.id, [{ id: "doc-9", kind: "document" }], 2, {
    excludes: []
  });
  assert.equal(cleared.excludes, undefined);
  assert.equal((await ctx.get(record.id))?.excludes, undefined);
});
