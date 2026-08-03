import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import Database from "better-sqlite3";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError,
  getResourceHistory
} from "../../src/0-utils/persistence/resourceHistory.js";
import type {
  AnalyticDefinition,
  StructuredAnalytic
} from "../../src/3-capabilities/structured-analytic/domain/model.js";
import {
  AnalyticIdRetiredError,
  CorruptAnalyticRowError,
  SQLiteStructuredAnalyticStore
} from "../../src/3-capabilities/structured-analytic/persistence/sqliteStructuredAnalyticStore.js";
import { createStructuredAnalyticTableNames } from "../../src/3-capabilities/structured-analytic/persistence/sqliteSchema.js";

const PROJECT = "project-structured-analytic-store";

const timestamp = (offset: number): string =>
  new Date(Date.UTC(2026, 0, 1, 0, 0, offset)).toISOString();

const storePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "icarus-sa-store-")), "analytics.db");

/**
 * Every store this file opens, closed once at the end. Without it the run
 * leaves a connection and a temp directory open per test — harmless at this
 * size and exactly the kind of thing that stops being harmless quietly.
 */
const opened: SQLiteStructuredAnalyticStore[] = [];
after(() => {
  for (const db of opened) db.close();
});

const storeAt = (path: string): SQLiteStructuredAnalyticStore => {
  const db = new SQLiteStructuredAnalyticStore(path, PROJECT);
  opened.push(db);
  return db;
};

const store = (): SQLiteStructuredAnalyticStore => storeAt(storePath());

const definition = (field = "region"): AnalyticDefinition => ({
  inputs: [{ name: "Orders" }],
  joins: [],
  rows: [],
  columns: [{ id: "c1", field: { input: "Orders", field }, aggregation: "none" }],
  filters: [],
  sorts: [],
  display: { kind: "table" }
});

const analytic = (patch: Partial<StructuredAnalytic> = {}): StructuredAnalytic => ({
  id: "an-1",
  title: "Revenue by region",
  definition: definition(),
  revision: 1,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: timestamp(0),
  updatedAt: timestamp(0),
  ...patch
});

/** The same record one revision on, as the service would build it. */
const next = (
  current: StructuredAnalytic,
  patch: Partial<StructuredAnalytic> = {}
): StructuredAnalytic => ({
  ...current,
  revision: current.revision + 1,
  updatedAt: timestamp(current.revision * 10),
  ...patch
});

// ─── Reads and writes ─────────────────────────────────────────────────────────

test("an inserted analytic reads back exactly, including absent optionals", async (t) => {
  await t.test("a record with no description round-trips", () => {
    const db = store();
    const record = analytic();
    db.insert(record);
    const read = db.get("an-1");

    // deepEqual, not field-by-field: a description written as `undefined`
    // rather than omitted passes every individual assertion and then fails a
    // history comparison later, where it looks like a history bug.
    assert.deepEqual(read, record);
    assert.equal("description" in (read as object), false);
  });

  await t.test("a description round-trips when present", () => {
    const db = store();
    const record = analytic({ description: "Closed deals only" });
    db.insert(record);
    assert.deepEqual(db.get("an-1"), record);
  });

  await t.test("the whole definition survives, not just its top level", () => {
    const rich: AnalyticDefinition = {
      inputs: [{ name: "Orders", entryId: "e1" }, { name: "Orders", as: "Prior" }],
      joins: [{ kind: "left", left: "Orders", right: "Prior",
                on: [{ leftField: "id", rightField: "priorId" }] }],
      rows: [{ id: "r", field: { input: "Prior", field: "amount" },
               aggregation: "sum", label: "Total" }],
      columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
      filters: [{ field: { input: "Orders", field: "tier" }, operator: "in",
                  values: [{ kind: "text", value: "gold" }, { kind: "null" }] }],
      sorts: [{ placementId: "r", direction: "desc" }],
      limit: 25,
      display: { kind: "bar" }
    };
    const db = store();
    const record = analytic({ definition: rich });
    db.insert(record);
    assert.deepEqual(db.get("an-1")?.definition, rich);
  });

  await t.test("a missing analytic reads as undefined", () => {
    assert.equal(store().get("nope"), undefined);
  });

  await t.test("a duplicate id throws rather than returning a result", () => {
    const db = store();
    db.insert(analytic());
    assert.throws(() => db.insert(analytic()), /UNIQUE|PRIMARY/i);
  });
});

test("list is ordered by updated_at descending, then id ascending", () => {
  const db = store();
  db.insert(analytic({ id: "b", updatedAt: timestamp(10) }));
  db.insert(analytic({ id: "a", updatedAt: timestamp(20) }));
  db.insert(analytic({ id: "c", updatedAt: timestamp(10) }));

  assert.deepEqual(db.list().map(a => a.id), ["a", "b", "c"]);
});

// ─── Compare-and-swap ─────────────────────────────────────────────────────────

test("update is a compare-and-swap that archives what it replaces", async (t) => {
  await t.test("a matching revision succeeds and advances", () => {
    const db = store();
    const first = analytic();
    db.insert(first);

    const second = next(first, { title: "Renamed" });
    assert.equal(db.update(second, 1), true);

    const read = db.get("an-1");
    assert.equal(read?.revision, 2);
    assert.equal(read?.title, "Renamed");
  });

  await t.test("the replaced revision is archived, not the replacement", () => {
    const db = store();
    const first = analytic();
    db.insert(first);
    db.update(next(first, { title: "Renamed" }), 1);

    // Revision 1's state, at revision 1 — this is the transition that would
    // otherwise leave no history at all.
    assert.deepEqual(db.latestSnapshot("an-1"), first);
  });

  await t.test("a stale revision changes nothing", () => {
    const db = store();
    const first = analytic();
    db.insert(first);
    db.update(next(first), 1);

    const stale = { ...first, revision: 2, title: "Should not land" };
    assert.equal(db.update(stale, 1), false);
    assert.equal(db.get("an-1")?.title, first.title);
    assert.equal(db.get("an-1")?.revision, 2);
  });

  await t.test("a missing analytic is false, not a throw", () => {
    assert.equal(store().update(analytic({ id: "ghost", revision: 2 }), 1), false);
  });

  // Nothing else checks this, and getting it wrong surfaces far away, as a
  // history primary-key collision on some later unrelated update.
  await t.test("a replacement that skips a revision is refused loudly", () => {
    const db = store();
    const first = analytic();
    db.insert(first);
    assert.throws(
      () => db.update({ ...first, revision: 5 }, 1),
      /replacement is at revision 5, expected 2/
    );
    assert.equal(db.get("an-1")?.revision, 1, "the failed update wrote nothing");
  });

  await t.test("history accumulates one snapshot per update", () => {
    const path = storePath();
    const db = storeAt(path);
    let current = analytic();
    db.insert(current);
    for (let i = 0; i < 3; i++) {
      const replacement = next(current, { title: `v${current.revision + 1}` });
      assert.equal(db.update(replacement, current.revision), true);
      current = replacement;
    }
    assert.equal(db.get("an-1")?.revision, 4);
    assert.equal(db.latestSnapshot("an-1")?.revision, 3, "the last archived is the last replaced");

    // The count, not just the newest — otherwise this passes whether the store
    // wrote one history row or three, which is the thing the title claims.
    const tables = createStructuredAnalyticTableNames(PROJECT);
    const history = getResourceHistory<StructuredAnalytic>(
      new Database(path), tables.history, "structured-analytic", "an-1"
    );
    assert.deepEqual(history.map(record => record.revision), [1, 2, 3]);
    assert.deepEqual(history.map(record => record.recordType), ["snapshot", "snapshot", "snapshot"]);
  });
});

// ─── Delete, purge ────────────────────────────────────────────────────────────

test("delete archives a final snapshot and a tombstone, then removes current state", async (t) => {
  await t.test("the analytic disappears from get and list", () => {
    const db = store();
    db.insert(analytic());
    assert.equal(db.delete("an-1", 1, timestamp(60)), true);
    assert.equal(db.get("an-1"), undefined);
    assert.deepEqual(db.list(), []);
  });

  await t.test("the final state stays recoverable", () => {
    const db = store();
    const record = analytic();
    db.insert(record);
    db.delete("an-1", 1, timestamp(60));
    assert.deepEqual(db.latestSnapshot("an-1"), record);
  });

  await t.test("a stale revision refuses and leaves the analytic live", () => {
    const db = store();
    db.insert(analytic());
    assert.equal(db.delete("an-1", 99, timestamp(60)), false);
    assert.ok(db.get("an-1"));
  });

  await t.test("a missing analytic is false", () => {
    assert.equal(store().delete("ghost", 1, timestamp(60)), false);
  });
});

// An id whose history survives cannot be used again. Without this, a re-insert
// succeeds, `latestSnapshot` reports the dead analytic's final state as the new
// one's, and the next update collides on the history primary key — rolling back
// every edit from then on, permanently and silently.
test("an id is retired until its history is purged", async (t) => {
  await t.test("re-inserting after a delete is refused", () => {
    const db = store();
    db.insert(analytic());
    db.delete("an-1", 1, timestamp(60));

    assert.throws(
      () => db.insert(analytic()),
      (error: unknown) => {
        assert.ok(error instanceof AnalyticIdRetiredError);
        assert.equal(error.analyticId, "an-1");
        assert.equal(error.survivingRevisions, 2, "snapshot@1 and tombstone@2");
        return true;
      }
    );
  });

  await t.test("purging first frees the id", () => {
    const db = store();
    db.insert(analytic());
    db.delete("an-1", 1, timestamp(60));
    db.purge("an-1");

    const reborn = analytic({ title: "Second life" });
    assert.doesNotThrow(() => db.insert(reborn));
    assert.deepEqual(db.get("an-1"), reborn);
    assert.equal(db.latestSnapshot("an-1"), undefined, "no inherited history");

    // And the update that used to collide now works.
    assert.equal(db.update(next(reborn, { title: "Edited" }), 1), true);
    assert.equal(db.get("an-1")?.revision, 2);
  });

  await t.test("an id with update history is retired too, not just a deleted one", () => {
    // Reachable without a delete: history exists from the first update onward.
    const db = store();
    const first = analytic();
    db.insert(first);
    db.update(next(first), 1);
    db.delete("an-1", 2, timestamp(60));

    assert.throws(() => db.insert(analytic()), AnalyticIdRetiredError);
  });
});

test("purge is legal only after delete", async (t) => {
  // The shared helper cannot enforce this: it never reads the current table.
  // Retiring reused ids makes "live analytic whose history ends in a tombstone"
  // unreachable, so this guard is now about returning the right error rather
  // than about preventing loss — a 409 saying delete it first, not a 404 saying
  // there is nothing here.
  await t.test("purging a live analytic refuses, and keeps its history", () => {
    const db = store();
    const first = analytic();
    db.insert(first);
    db.update(next(first), 1);

    assert.throws(() => db.purge("an-1"), ResourceNotDeletedError);
    assert.deepEqual(db.latestSnapshot("an-1"), first, "history survived the refusal");
  });

  await t.test("purging after delete drops the history", () => {
    const db = store();
    db.insert(analytic());
    db.delete("an-1", 1, timestamp(60));
    assert.ok(db.latestSnapshot("an-1"), "history exists before purge");

    db.purge("an-1");
    assert.equal(db.latestSnapshot("an-1"), undefined);
  });

  await t.test("purging something with no history at all is a not-found", () => {
    assert.throws(() => store().purge("ghost"), ResourceHistoryNotFoundError);
  });
});

// ─── repairInputNames ─────────────────────────────────────────────────────────

// Four independent ways to get this wrong, each invisible in normal use. The
// plan's exit criterion covers only the third.
test("repairInputNames heals a name without behaving like an edit", async (t) => {
  const setup = () => {
    const db = store();
    const record = analytic();
    db.insert(record);
    return { db, record };
  };

  await t.test("it rewrites the definition", () => {
    const { db } = setup();
    assert.equal(db.repairInputNames("an-1", 1, definition("territory")), true);
    assert.equal(db.get("an-1")?.definition.columns[0].field.field, "territory");
  });

  await t.test("it does not advance the revision", () => {
    // A bump would invalidate every open editor's expectedRevision because
    // somebody else merely viewed a chart. Renames are rare; authored edits
    // are not.
    const { db } = setup();
    db.repairInputNames("an-1", 1, definition("territory"));
    assert.equal(db.get("an-1")?.revision, 1);
  });

  await t.test("it does not touch updated_at, so list() does not reorder", () => {
    const { db, record } = setup();
    db.insert(analytic({ id: "an-2", updatedAt: timestamp(5) }));
    const before = db.list().map(a => a.id);

    db.repairInputNames("an-1", 1, definition("territory"));

    assert.equal(db.get("an-1")?.updatedAt, record.updatedAt);
    assert.deepEqual(db.list().map(a => a.id), before, "a read must not reorder the catalog");
  });

  await t.test("it writes no history", () => {
    // An extra record at the current revision collides on the next real update,
    // far from the mistake that caused it.
    const { db, record } = setup();
    db.repairInputNames("an-1", 1, definition("territory"));
    assert.equal(db.latestSnapshot("an-1"), undefined, "repair is not an authored revision");

    // And the next genuine update still works, which is what the collision
    // would have broken.
    const healed = db.get("an-1") as StructuredAnalytic;
    assert.equal(db.update(next(healed, { title: "Edited" }), 1), true);
    assert.equal(db.get("an-1")?.revision, 2);
  });

  await t.test("it loses cleanly to a concurrent authored edit", () => {
    // Without the revision condition, a repair computed against a stale read
    // would silently overwrite the edit — and leave no history of what it
    // destroyed, because repairs write none by design.
    const { db, record } = setup();
    db.update(next(record, { title: "Edited concurrently" }), 1);

    assert.equal(db.repairInputNames("an-1", 1, definition("territory")), false);
    const read = db.get("an-1");
    assert.equal(read?.title, "Edited concurrently");
    assert.equal(read?.definition.columns[0].field.field, "region", "the edit survived");
  });

  await t.test("a missing analytic is false", () => {
    assert.equal(store().repairInputNames("ghost", 1, definition()), false);
  });
});

// ─── Retention ────────────────────────────────────────────────────────────────

// What prune actually does, which is not what "retaining current resources"
// suggests: history is a bounded window, so an old snapshot is dropped whether
// or not its analytic is live. What survives the cutoff unconditionally is the
// terminal tombstone, so a deleted analytic stays discoverable as deleted — and
// therefore stays purgeable.
test("retention bounds the history window, and protects the tombstone", async (t) => {
  await t.test("an old snapshot is pruned even while the analytic is live", () => {
    const db = store();
    const first = analytic();
    db.insert(first);
    db.update(next(first), 1);
    assert.deepEqual(db.latestSnapshot("an-1"), first, "archived before pruning");

    assert.equal(db.pruneHistory(timestamp(10_000)), 1);
    assert.equal(db.latestSnapshot("an-1"), undefined, "history is a window, not an archive");
    assert.ok(db.get("an-1"), "the analytic itself is untouched");
  });

  await t.test("the analytic itself is never touched by pruning", () => {
    const db = store();
    const first = analytic();
    db.insert(first);
    db.update(next(first, { title: "Edited" }), 1);

    db.pruneHistory(timestamp(10_000));
    const read = db.get("an-1");
    assert.equal(read?.title, "Edited");
    assert.equal(read?.revision, 2);
  });

  await t.test("a deleted analytic keeps its tombstone past the cutoff", () => {
    // Without this the record would silently stop being reported as deleted,
    // and purgeExpired could never find it to clean up.
    const db = store();
    db.insert(analytic());
    db.delete("an-1", 1, timestamp(10));

    db.pruneHistory(timestamp(10_000));
    assert.deepEqual(db.expiredDeleted(timestamp(10_000)), ["an-1"], "still discoverable");
  });

  await t.test("expiredDeleted reports tombstones older than the cutoff", () => {
    const db = store();
    db.insert(analytic({ id: "old" }));
    db.insert(analytic({ id: "recent" }));
    db.delete("old", 1, timestamp(10));
    db.delete("recent", 1, timestamp(900));

    assert.deepEqual(db.expiredDeleted(timestamp(100)), ["old"]);
  });

  await t.test("nothing is expired when the cutoff predates every tombstone", () => {
    const db = store();
    db.insert(analytic());
    db.delete("an-1", 1, timestamp(900));
    assert.deepEqual(db.expiredDeleted(timestamp(100)), []);
  });
});

// ─── Storage details worth pinning ────────────────────────────────────────────

test("both JSON columns are TEXT — that agreement is why TEXT was chosen", () => {
  // A Buffer encoder would round-trip as a Uint8Array and be accepted silently
  // by SQLite's dynamic typing, then fail on read. Checking only the analytics
  // table would leave the half of the claim that motivated it unverified.
  const path = storePath();
  const db = storeAt(path);
  const first = analytic();
  db.insert(first);
  db.update(next(first, { title: "Edited" }), 1);

  const tables = createStructuredAnalyticTableNames(PROJECT);
  const connection = new Database(path);

  const current = connection
    .prepare(`SELECT typeof(definition_json) AS kind, definition_json AS body FROM ${tables.analytics}`)
    .get() as { kind: string; body: unknown };
  assert.equal(current.kind, "text");
  assert.deepEqual(JSON.parse(current.body as string), definition());

  const archived = connection
    .prepare(`SELECT typeof(snapshot_json) AS kind FROM ${tables.history} WHERE snapshot_json IS NOT NULL`)
    .get() as { kind: string };
  assert.equal(archived.kind, "text", "the history table's encoding is the one being matched");
});

test("an unreadable definition names the row rather than throwing a bare SyntaxError", async (t) => {
  const corrupted = (value: unknown): SQLiteStructuredAnalyticStore => {
    const path = storePath();
    const db = storeAt(path);
    db.insert(analytic());
    const tables = createStructuredAnalyticTableNames(PROJECT);
    new Database(path)
      .prepare(`UPDATE ${tables.analytics} SET definition_json = ? WHERE id = ?`)
      .run(value, "an-1");
    return db;
  };

  await t.test("a damaged string reports which row it was", () => {
    const db = corrupted("{ not json");
    assert.throws(
      () => db.get("an-1"),
      (error: unknown) => {
        assert.ok(error instanceof CorruptAnalyticRowError);
        assert.equal(error.analyticId, "an-1");
        assert.match(error.reason, /JSON|token|Unexpected/i);
        return true;
      }
    );
  });

  await t.test("a value written with a BLOB encoder is caught, not parsed", () => {
    // The hazard TEXT was chosen to avoid: SQLite stores a Buffer in a TEXT
    // column unchanged and hands it back as a Uint8Array.
    const db = corrupted(Buffer.from(JSON.stringify(definition()), "utf8"));
    assert.throws(
      () => db.get("an-1"),
      (error: unknown) => {
        assert.ok(error instanceof CorruptAnalyticRowError);
        assert.match(error.reason, /expected TEXT/);
        return true;
      }
    );
  });
});

test("two projects do not share a table", () => {
  const a = createStructuredAnalyticTableNames("project-a");
  const b = createStructuredAnalyticTableNames("project-b");
  assert.notEqual(a.analytics, b.analytics);
  assert.notEqual(a.history, b.history);
  assert.match(a.analytics, /^sta_[0-9a-f]{16}_analytics$/);
  assert.match(a.history, /^sta_[0-9a-f]{16}_history$/);
});
