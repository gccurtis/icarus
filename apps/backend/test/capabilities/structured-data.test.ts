// Structured Data's own behaviour, as distinct from its Formula integration.
//
// Written after an audit found that `updateBody`, `appendRows`, `deleteRows`,
// `getByName`, `rowCount`, `query`, `pruneHistory`, and `purgeExpired` appeared
// in no test file at all — while the capability is the authority for every
// Formula-visible name in the project, and two of those run on a schedule
// against real history.
//
// The bias throughout is round-trip assertions over `doesNotThrow`: a suite
// that only proves a value was accepted cannot tell you it was preserved.

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createFormulaEngine } from "../../src/0-platform/formula/engine.js";
import { createFormulaNameResolver } from "../../src/1-init/create/formula-name-resolver.js";
import { toWire } from "../../src/0-platform/formula/wire.js";
import { normalizeKey } from "../../src/0-platform/formula/resolver.js";
import { createStructuredData } from "../../src/3-capabilities/structured-data/structured-data.js";
import { SQLiteDataStore } from "../../src/3-capabilities/structured-data/sqlite-store.js";
import {
  DataEntryConflictError,
  DataEntryNotFoundError,
  StaleDataRevisionError,
  type CollectionEntry,
  type FormulaEntry
} from "../../src/3-capabilities/structured-data/types.js";
import { DataValidationError } from "../../src/3-capabilities/structured-data/validation.js";
import { CapturingLogger, TEST_FORMULA_LIMITS } from "../helpers/testDoubles.js";

const LIMITS = {
  maxDisplayNameBytes: 256,
  maxEntries: 100,
  maxFieldsPerCollection: 20,
  maxRowsPerCollection: 100,
  maxBodyBytes: 65_536
};

const databasePath = (name = "structured-data"): string =>
  join(mkdtempSync(join(tmpdir(), `icarus-${name}-`)), "test.db");

const harness = (overrides: Partial<typeof LIMITS> = {}, path = databasePath()) => {
  const logger = new CapturingLogger();
  const formula = createFormulaEngine(TEST_FORMULA_LIMITS, logger);
  const store = new SQLiteDataStore("test-project", path);
  const data = createStructuredData(store, { ...LIMITS, ...overrides }, logger);
  const resolver = createFormulaNameResolver(formula, data, logger, {
    userId: "test-user",
    projectId: "test-project"
  });
  return { data, formula, logger, resolver, store, path };
};

// ─── The cache hazard ─────────────────────────────────────────────────────────

// The single most valuable test here. The resolver caches its snapshot on a
// signature of `id:revision:displayName:kind`, and before this the only tests
// that rebuilt a snapshot changed a *name* or an *id*. Drop `revision` from
// that signature and every other test still passes, while every content edit in
// production serves the pre-edit value until an unrelated rename busts the
// cache.
test("a content edit is visible in a snapshot rebuilt on the same resolver", async (t) => {
  await t.test("updateBody", async () => {
    const { data, resolver } = harness();
    const entry = await data.declare({ kind: "variable", displayName: "rate", body: "1" });

    const before = await resolver.buildSnapshot();
    assert.deepEqual(
      toWire(before.bindings.get(normalizeKey("rate"))!.value),
      { kind: "number", numerator: "1", denominator: "1" }
    );

    await data.updateBody({ id: entry.id, body: "2", expectedRevision: entry.revision });

    const after = await resolver.buildSnapshot();
    assert.deepEqual(
      toWire(after.bindings.get(normalizeKey("rate"))!.value),
      { kind: "number", numerator: "2", denominator: "1" },
      "the rebuilt snapshot must not serve the pre-edit value"
    );
  });

  await t.test("appendRows", async () => {
    const { data, resolver } = harness();
    const table = await data.declare({
      kind: "table",
      displayName: "readings",
      schema: [{ name: "v", kind: "number" }],
      rows: [{ v: 1 }]
    });

    const before = await resolver.buildSnapshot();
    const beforeValue = toWire(before.bindings.get(normalizeKey("readings"))!.value);
    assert.equal(beforeValue.kind === "table" && beforeValue.rows.length, 1);

    await data.appendRows({ id: table.id, rows: [{ v: 2 }], expectedRevision: table.revision });

    const after = await resolver.buildSnapshot();
    const afterValue = toWire(after.bindings.get(normalizeKey("readings"))!.value);
    assert.equal(afterValue.kind === "table" && afterValue.rows.length, 2);
  });

  await t.test("an unchanged project does reuse the cached snapshot", async () => {
    // The other half: the cache must still be a cache.
    const { data, resolver, logger } = harness();
    await data.declare({ kind: "variable", displayName: "stable", body: "1" });
    const first = await resolver.buildSnapshot();
    const second = await resolver.buildSnapshot();

    assert.equal(first, second, "same object, not merely equal");
    assert.ok(logger.entries.some(e => e.message === "formula-resolver.snapshot.cache-hit"));
  });
});

// ─── Round trip ───────────────────────────────────────────────────────────────

test("a declared entry reads back exactly, field for field", async (t) => {
  await t.test("a collection, including rowCount and timestamps", async () => {
    const { data } = harness();
    const declared = await data.declare({
      kind: "table",
      displayName: "Cells",
      description: "one of every literal kind",
      schema: [
        { name: "t", kind: "text" },
        { name: "n", kind: "number" },
        { name: "b", kind: "logic" },
        { name: "nothing", kind: "text" },
        { name: "absent", kind: "text" }
      ],
      // The last field is deliberately omitted from the row: a missing key is
      // legal and becomes null on resolution.
      rows: [{ t: "hello", n: -1.5, b: true, nothing: null }]
    });

    const read = (await data.get(declared.id)) as CollectionEntry;
    assert.deepEqual(read, declared, "get() must return exactly what declare() did");

    assert.equal(read.kind, "table");
    assert.equal(read.displayName, "Cells");
    assert.equal(read.description, "one of every literal kind");
    assert.equal(read.revision, 1, "a declared entry starts at revision 1");
    assert.equal(read.createdAt, read.updatedAt);
    assert.deepEqual(read.contextEntries, []);
    // Denormalised, and nothing else in the suite reads it.
    assert.equal(read.rowCount, read.rows.length);
    assert.equal(read.rowCount, 1);
    assert.deepEqual(read.rows[0], { t: "hello", n: -1.5, b: true, nothing: null });
  });

  await t.test("literal cells resolve to the Formula values they claim to be", async () => {
    // Literal cells previously never round-tripped through resolution at all;
    // numbers in particular go through `fromDecimalString(String(v))`.
    const { data, resolver } = harness();
    await data.declare({
      kind: "table",
      displayName: "Cells",
      schema: [
        { name: "t", kind: "text" },
        { name: "n", kind: "number" },
        { name: "b", kind: "logic" },
        { name: "nothing", kind: "text" },
        { name: "absent", kind: "text" }
      ],
      rows: [{ t: "hello", n: -1.5, b: true, nothing: null }]
    });

    const snapshot = await resolver.buildSnapshot();
    const value = toWire(snapshot.bindings.get(normalizeKey("Cells"))!.value);
    assert.equal(value.kind, "table");
    if (value.kind !== "table") return;

    const cell = (name: string) => value.rows[0][value.fields.indexOf(name)];
    assert.deepEqual(cell("t"), { kind: "text", value: "hello" });
    // -1.5 exactly, as a rational — not a float.
    assert.deepEqual(cell("n"), { kind: "number", numerator: "-3", denominator: "2" });
    assert.deepEqual(cell("b"), { kind: "logic", value: true });
    // An authored null stays a real null, and a missing key becomes one.
    assert.deepEqual(cell("nothing"), { kind: "null" });
    assert.deepEqual(cell("absent"), { kind: "null" });
  });

  await t.test("a formula entry", async () => {
    const { data } = harness();
    const declared = await data.declare({
      kind: "variable",
      displayName: "total",
      body: "SUM([1, 2])"
    });
    const read = (await data.get(declared.id)) as FormulaEntry;
    assert.deepEqual(read, declared);
    assert.equal(read.body, "SUM([1, 2])");
    assert.equal(read.revision, 1);
  });
});

// ─── Row mutation ─────────────────────────────────────────────────────────────

test("appendRows and deleteRows keep rowCount and order honest", async (t) => {
  const table = async () => {
    const h = harness();
    const entry = await h.data.declare({
      kind: "table",
      displayName: "measurements",
      schema: [{ name: "v", kind: "number" }],
      rows: [{ v: 1 }, { v: 2 }, { v: 3 }]
    });
    return { ...h, entry };
  };

  await t.test("append puts new rows after the existing ones", async () => {
    const { data, entry } = await table();
    const updated = await data.appendRows({
      id: entry.id,
      rows: [{ v: 4 }],
      expectedRevision: 1
    });
    assert.deepEqual(updated.rows, [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }]);
    assert.equal(updated.rowCount, 4);
    assert.equal(updated.revision, 2);
    assert.deepEqual(((await data.get(entry.id)) as CollectionEntry).rows, updated.rows);
  });

  await t.test("delete removes exactly the named indices, keeping order", async () => {
    const { data, entry } = await table();
    const updated = await data.deleteRows({ id: entry.id, indices: [0, 2], expectedRevision: 1 });
    assert.deepEqual(updated.rows, [{ v: 2 }]);
    assert.equal(updated.rowCount, 1);
  });

  await t.test("an empty append or delete still produces a new revision", async () => {
    const { data, entry } = await table();
    const appended = await data.appendRows({ id: entry.id, rows: [], expectedRevision: 1 });
    assert.equal(appended.revision, 2);
    assert.equal(appended.rowCount, 3);
    const deleted = await data.deleteRows({ id: entry.id, indices: [], expectedRevision: 2 });
    assert.equal(deleted.revision, 3);
    assert.equal(deleted.rowCount, 3);
  });

  await t.test("bad indices are refused", async () => {
    const { data, entry } = await table();
    for (const indices of [[3], [-1], [1.5], [0, 0]]) {
      await assert.rejects(
        () => data.deleteRows({ id: entry.id, indices, expectedRevision: 1 }),
        DataValidationError,
        `indices ${JSON.stringify(indices)} must be refused`
      );
    }
    assert.equal(((await data.get(entry.id)) as CollectionEntry).revision, 1, "nothing changed");
  });

  await t.test("append is bounded by maxRowsPerCollection, counting existing rows", async () => {
    const h = harness({ maxRowsPerCollection: 4 });
    const entry = await h.data.declare({
      kind: "table",
      displayName: "measurements",
      schema: [{ name: "v", kind: "number" }],
      rows: [{ v: 1 }, { v: 2 }, { v: 3 }]
    });
    await assert.rejects(
      () => h.data.appendRows({ id: entry.id, rows: [{ v: 4 }, { v: 5 }], expectedRevision: 1 }),
      /would exceed maxRowsPerCollection/
    );
    await h.data.appendRows({ id: entry.id, rows: [{ v: 4 }], expectedRevision: 1 });
  });

  await t.test("a record keeps exactly one row on both paths", async () => {
    const { data } = harness();
    const record = await data.declare({
      kind: "record",
      displayName: "config",
      schema: [{ name: "v", kind: "number" }],
      rows: [{ v: 1 }]
    });
    await assert.rejects(
      () => data.appendRows({ id: record.id, rows: [{ v: 2 }], expectedRevision: 1 }),
      /exactly one row/
    );
    await assert.rejects(
      () => data.deleteRows({ id: record.id, indices: [0], expectedRevision: 1 }),
      /exactly one row/
    );
  });

  await t.test("a stale revision changes nothing", async () => {
    const { data, entry } = await table();
    await data.appendRows({ id: entry.id, rows: [{ v: 4 }], expectedRevision: 1 });
    await assert.rejects(
      () => data.appendRows({ id: entry.id, rows: [{ v: 5 }], expectedRevision: 1 }),
      StaleDataRevisionError
    );
    assert.equal(((await data.get(entry.id)) as CollectionEntry).rowCount, 4);
  });
});

// ─── updateBody and replaceSchema ─────────────────────────────────────────────

test("updateBody replaces the body and advances the revision", async (t) => {
  await t.test("the new body is stored and returned", async () => {
    const { data } = harness();
    const entry = await data.declare({ kind: "variable", displayName: "v", body: "1" });
    const updated = await data.updateBody({ id: entry.id, body: "2", expectedRevision: 1 });
    assert.equal(updated.body, "2");
    assert.equal(updated.revision, 2);
    assert.equal(updated.id, entry.id, "the id survives an edit");
    assert.equal(((await data.get(entry.id)) as FormulaEntry).body, "2");
  });

  await t.test("a stale revision is refused", async () => {
    const { data } = harness();
    const entry = await data.declare({ kind: "variable", displayName: "v", body: "1" });
    await data.updateBody({ id: entry.id, body: "2", expectedRevision: 1 });
    await assert.rejects(
      () => data.updateBody({ id: entry.id, body: "3", expectedRevision: 1 }),
      StaleDataRevisionError
    );
    assert.equal(((await data.get(entry.id)) as FormulaEntry).body, "2");
  });

  await t.test("a missing entry is a not-found", async () => {
    const { data } = harness();
    await assert.rejects(
      () => data.updateBody({ id: "ghost", body: "1", expectedRevision: 1 }),
      DataEntryNotFoundError
    );
  });
});

test("a schema replacement that would invalidate retained rows changes nothing", async () => {
  const { data } = harness();
  const table = await data.declare({
    kind: "table",
    displayName: "typed",
    schema: [{ name: "value", kind: "number" }],
    rows: [{ value: 1 }]
  });

  await assert.rejects(
    () => data.replaceSchema({
      id: table.id,
      schema: [{ name: "value", kind: "text" }],
      expectedRevision: 1
    }),
    DataValidationError
  );

  // The original assertion only checked that the revision had not moved, which
  // a replaceSchema that wrote the schema without bumping would also satisfy.
  assert.deepEqual(await data.get(table.id), table, "schema and rows both untouched");
});

// ─── Kind guards ──────────────────────────────────────────────────────────────

test("collection operations refuse a formula entry, and the reverse", async () => {
  const { data } = harness();
  const variable = await data.declare({ kind: "variable", displayName: "v", body: "1" });
  const table = await data.declare({
    kind: "table",
    displayName: "t",
    schema: [{ name: "v", kind: "number" }],
    rows: []
  });

  await assert.rejects(
    () => data.replaceSchema({ id: variable.id, schema: [], expectedRevision: 1 }),
    /requires a collection entry/
  );
  await assert.rejects(
    () => data.appendRows({ id: variable.id, rows: [], expectedRevision: 1 }),
    /requires a collection entry/
  );
  await assert.rejects(
    () => data.deleteRows({ id: variable.id, indices: [], expectedRevision: 1 }),
    /requires a collection entry/
  );
  await assert.rejects(
    () => data.updateBody({ id: table.id, body: "1", expectedRevision: 1 }),
    /requires a variable or function entry/
  );
});

// ─── Rename ───────────────────────────────────────────────────────────────────

test("rename changes the name and keeps the identity", async (t) => {
  await t.test("the id survives and the revision advances", async () => {
    const { data } = harness();
    const entry = await data.declare({ kind: "variable", displayName: "Revenue", body: "1" });
    const renamed = await data.rename({
      id: entry.id,
      newDisplayName: "NetRevenue",
      expectedRevision: 1
    });

    assert.equal(renamed.id, entry.id, "a rename is not a replacement");
    assert.equal(renamed.displayName, "NetRevenue");
    assert.equal(renamed.revision, 2);
    assert.equal((await data.getByName("NetRevenue"))?.id, entry.id);
    assert.equal(await data.getByName("Revenue"), undefined);
  });

  await t.test("renaming onto another entry's name conflicts", async () => {
    const { data } = harness();
    await data.declare({ kind: "variable", displayName: "taken", body: "1" });
    const other = await data.declare({ kind: "variable", displayName: "free", body: "1" });
    await assert.rejects(
      () => data.rename({ id: other.id, newDisplayName: "TAKEN", expectedRevision: 1 }),
      DataEntryConflictError
    );
  });

  await t.test("renaming an entry to a case variant of its own name succeeds", async () => {
    // The self-collision guard. Without it this would conflict with itself.
    const { data } = harness();
    const entry = await data.declare({ kind: "variable", displayName: "Revenue", body: "1" });
    const renamed = await data.rename({
      id: entry.id,
      newDisplayName: "revenue",
      expectedRevision: 1
    });
    assert.equal(renamed.displayName, "revenue");
    assert.equal(renamed.id, entry.id);
  });
});

// ─── Reads ────────────────────────────────────────────────────────────────────

test("getByName matches the way Formula matches names", async () => {
  const { data } = harness();
  const entry = await data.declare({ kind: "variable", displayName: "Revenue", body: "1" });

  assert.equal((await data.getByName("Revenue"))?.id, entry.id);
  assert.equal((await data.getByName("revenue"))?.id, entry.id, "case-insensitive");
  assert.equal((await data.getByName("  Revenue  "))?.id, entry.id, "trimmed");
  assert.equal(await data.getByName("Missing"), undefined);
});

test("list filters by kind and orders by display name, case-insensitively", async () => {
  const { data } = harness();
  await data.declare({ kind: "variable", displayName: "beta", body: "1" });
  await data.declare({ kind: "variable", displayName: "Alpha", body: "1" });
  await data.declare({
    kind: "table", displayName: "gamma",
    schema: [{ name: "v", kind: "number" }], rows: []
  });

  assert.deepEqual(
    (await data.list("variable")).map(e => e.displayName),
    ["Alpha", "beta"],
    "kind-filtered, and 'Alpha' before 'beta' despite the capital"
  );
  assert.deepEqual((await data.list("table")).map(e => e.displayName), ["gamma"]);
  assert.equal((await data.list()).length, 3);
});

test("query filters by text and by scope", async (t) => {
  const setup = async () => {
    const h = harness();
    await h.data.declare({
      kind: "variable", displayName: "Revenue", description: "quarterly total", body: "1"
    });
    await h.data.declare({
      kind: "variable", displayName: "Headcount", description: "people", body: "1"
    });
    return h;
  };

  await t.test("text matches the display name, case-insensitively", async () => {
    const { data } = await setup();
    const result = await data.query({ text: "revenue" });
    assert.deepEqual(result.entries.map(e => e.displayName), ["Revenue"]);
    assert.equal(result.totalCount, 1);
  });

  await t.test("text also matches the description", async () => {
    const { data } = await setup();
    const result = await data.query({ text: "quarterly" });
    assert.deepEqual(result.entries.map(e => e.displayName), ["Revenue"]);
  });

  await t.test("text and kind compose", async () => {
    const { data } = await setup();
    assert.equal((await data.query({ kind: "table", text: "revenue" })).entries.length, 0);
  });

  // An entry with no context entries is relevant to the whole project, so it
  // matches every scope. Before this it matched none — and since nothing ever
  // populates contextEntries, a scope filter returned an empty list for every
  // query rather than an error.
  await t.test("a project-wide entry matches any scope", async () => {
    const { data } = await setup();
    const scoped = await data.query({
      scope: [{ kind: "document", id: "doc-1" } as never]
    });
    assert.equal(scoped.entries.length, 2, "[] context means the whole project");
  });

  await t.test("scope composes with text rather than replacing it", async () => {
    const { data } = await setup();
    const scoped = await data.query({
      text: "revenue",
      scope: [{ kind: "document", id: "doc-1" } as never]
    });
    assert.deepEqual(scoped.entries.map(e => e.displayName), ["Revenue"]);
  });
});

// ─── Limits ───────────────────────────────────────────────────────────────────

test("the configured limits bind", async (t) => {
  await t.test("maxEntries, at the boundary", async () => {
    const { data } = harness({ maxEntries: 2 });
    await data.declare({ kind: "variable", displayName: "one", body: "1" });
    await data.declare({ kind: "variable", displayName: "two", body: "1" });
    await assert.rejects(
      () => data.declare({ kind: "variable", displayName: "three", body: "1" }),
      /maxEntries \(2\) reached/
    );
  });

  await t.test("maxDisplayNameBytes", async () => {
    const { data } = harness({ maxDisplayNameBytes: 8 });
    await data.declare({ kind: "variable", displayName: "abcdefgh", body: "1" });
    await assert.rejects(
      () => data.declare({ kind: "variable", displayName: "abcdefghi", body: "1" }),
      DataValidationError
    );
  });

  await t.test("maxBodyBytes", async () => {
    const { data } = harness({ maxBodyBytes: 8 });
    await assert.rejects(
      () => data.declare({ kind: "variable", displayName: "v", body: "1".repeat(9) }),
      DataValidationError
    );
  });

  await t.test("maxFieldsPerCollection", async () => {
    const { data } = harness({ maxFieldsPerCollection: 2 });
    await assert.rejects(
      () => data.declare({
        kind: "table",
        displayName: "wide",
        schema: [
          { name: "a", kind: "number" },
          { name: "b", kind: "number" },
          { name: "c", kind: "number" }
        ],
        rows: []
      }),
      DataValidationError
    );
  });

  await t.test("maxRowsPerCollection at declare", async () => {
    const { data } = harness({ maxRowsPerCollection: 2 });
    await assert.rejects(
      () => data.declare({
        kind: "table",
        displayName: "tall",
        schema: [{ name: "v", kind: "number" }],
        rows: [{ v: 1 }, { v: 2 }, { v: 3 }]
      }),
      DataValidationError
    );
  });
});

test("a non-finite or unsafe number is refused in a cell", async () => {
  const { data } = harness();
  for (const v of [Number.POSITIVE_INFINITY, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(
      () => data.declare({
        kind: "table",
        displayName: `n${String(v)}`,
        schema: [{ name: "v", kind: "number" }],
        rows: [{ v }]
      }),
      DataValidationError,
      `${String(v)} must be refused`
    );
  }
});

// ─── Retention ────────────────────────────────────────────────────────────────

test("retention prunes superseded history and purges expired deletions", async (t) => {
  const future = new Date(Date.UTC(2100, 0, 1)).toISOString();

  await t.test("an old snapshot is pruned while the entry stays live", async () => {
    const { data } = harness();
    const entry = await data.declare({ kind: "variable", displayName: "v", body: "1" });
    await data.updateBody({ id: entry.id, body: "2", expectedRevision: 1 });

    assert.ok(data.pruneHistory(future) >= 1, "the superseded snapshot was pruned");
    assert.equal(((await data.get(entry.id)) as FormulaEntry).body, "2", "the entry is untouched");
  });

  await t.test("a deleted entry stays purgeable after a prune", async () => {
    // The hazard the sibling capability has an explicit regression test for:
    // pruning must not remove the terminal deletion record, or purgeExpired can
    // never find the resource again.
    const { data } = harness();
    const entry = await data.declare({ kind: "variable", displayName: "v", body: "1" });
    await data.delete({ id: entry.id, expectedRevision: 1 });

    data.pruneHistory(future);
    assert.equal(data.purgeExpired(future), 1, "still discoverable as deleted after pruning");
    // And purging is idempotent in the sense that there is nothing left to find.
    assert.equal(data.purgeExpired(future), 0);
  });

  await t.test("a live entry is never purged by the sweep", async () => {
    const { data } = harness();
    const entry = await data.declare({ kind: "variable", displayName: "v", body: "1" });
    await data.updateBody({ id: entry.id, body: "2", expectedRevision: 1 });

    assert.equal(data.purgeExpired(future), 0);
    assert.ok(await data.get(entry.id));
  });
});

// ─── Scoping ──────────────────────────────────────────────────────────────────

// The capability's only isolation claim. The existing suite proves two stores
// with the *same* owner share a file; this is the complementary half.
test("two owners on one database file do not see each other's entries", async () => {
  const path = databasePath("shared-file");
  const logger = new CapturingLogger();
  const alice = createStructuredData(new SQLiteDataStore("alice", path), LIMITS, logger);
  const bob = createStructuredData(new SQLiteDataStore("bob", path), LIMITS, logger);

  const aliceEntry = await alice.declare({ kind: "variable", displayName: "shared", body: "1" });
  const bobEntry = await bob.declare({ kind: "variable", displayName: "shared", body: "2" });

  assert.notEqual(aliceEntry.id, bobEntry.id, "the same name in two projects is two entries");
  assert.equal((await alice.getByName("shared"))?.id, aliceEntry.id);
  assert.equal((await bob.getByName("shared"))?.id, bobEntry.id);
  assert.equal((await alice.list()).length, 1);
  assert.equal((await bob.list()).length, 1);
  assert.equal(await alice.get(bobEntry.id), undefined, "and ids do not cross over");
});
