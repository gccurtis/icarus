// The service against a real SQLite store, a real Formula engine, and fake
// project data — so a pull genuinely joins, filters, groups, and evaluates.
//
// Only the two ports that reach outside the capability are doubled. Faking the
// store or the engine would leave the interesting half untested: almost every
// bug found in this capability so far lived in the seam between them.

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import {
  createFormulaEngine,
  makeNumber,
  makeTable,
  makeText,
  type FormulaResolverSnapshot,
  type FormulaValue,
  type ResolvedFormulaBinding
} from "../../src/0-platform/formula/index.js";
import { normalizeKey } from "../../src/0-platform/formula/resolver.js";
import { fromInt } from "../../src/0-platform/formula/rational.js";
import { createStructuredAnalyticService } from "../../src/3-capabilities/structured-analytic/application/structuredAnalyticService.js";
import {
  AnalyticNotFoundError,
  AnalyticPullError,
  StaleAnalyticRevisionError
} from "../../src/3-capabilities/structured-analytic/domain/errors.js";
import {
  DEFAULT_STRUCTURED_ANALYTIC_LIMITS,
  type AnalyticDefinition
} from "../../src/3-capabilities/structured-analytic/domain/model.js";
import { SQLiteStructuredAnalyticStore } from "../../src/3-capabilities/structured-analytic/persistence/sqliteStructuredAnalyticStore.js";
import type {
  ProjectData,
  ProjectEntryMetadata
} from "../../src/3-capabilities/structured-analytic/ports/projectData.js";
import type {
  DeclaredEntry,
  StructuredDataWriter
} from "../../src/3-capabilities/structured-analytic/ports/structuredDataWriter.js";
import { CapturingLogger, TEST_FORMULA_LIMITS } from "../helpers/testDoubles.js";

const num = (n: number): FormulaValue => makeNumber(fromInt(BigInt(n)));

const opened: SQLiteStructuredAnalyticStore[] = [];
after(() => {
  for (const store of opened) store.close();
});

/** One project entry: an identity, a value, and optionally a reason it is broken. */
interface Entry {
  readonly entryId: string;
  displayName: string;
  revision: number;
  readonly value: FormulaValue;
  issue?: { code: string; message: string };
}

/**
 * Project data backed by a mutable list, so a test can rename an entry, break
 * it, or point a name at a different id between calls — which is the whole
 * behaviour under test.
 */
class FakeProjectData implements ProjectData {
  constructor(readonly entries: Entry[]) {}

  async snapshot(): Promise<FormulaResolverSnapshot> {
    const bindings = new Map<string, ResolvedFormulaBinding>();
    for (const entry of this.entries) {
      bindings.set(normalizeKey(entry.displayName), {
        reference: {
          kind: "binding",
          bindingId: entry.entryId,
          ownerRevision: entry.revision,
          valueDigest: "vd"
        },
        displayName: entry.displayName,
        normalizedLookupKey: normalizeKey(entry.displayName),
        value: entry.value,
        ownerRevision: entry.revision,
        valueDigest: "vd"
      });
    }
    return {
      id: "snapshot-service",
      scope: { userId: "user-1", projectId: "project-1" },
      bindings,
      snapshotDigest: "digest",
      createdFrom: []
    };
  }

  private describe(entry: Entry): ProjectEntryMetadata {
    return {
      entryId: entry.entryId,
      displayName: entry.displayName,
      revision: entry.revision,
      ...(entry.issue !== undefined ? { issue: entry.issue } : {})
    };
  }

  async metadata(displayName: string): Promise<ProjectEntryMetadata | undefined> {
    const entry = this.entries.find(
      candidate => normalizeKey(candidate.displayName) === normalizeKey(displayName)
    );
    return entry ? this.describe(entry) : undefined;
  }

  async metadataById(entryId: string): Promise<ProjectEntryMetadata | undefined> {
    const entry = this.entries.find(candidate => candidate.entryId === entryId);
    return entry ? this.describe(entry) : undefined;
  }
}

class FakeWriter implements StructuredDataWriter {
  readonly formulas: Array<{ displayName: string; body: string }> = [];
  readonly tables: Array<{
    displayName: string;
    fields: readonly string[];
    rows: readonly unknown[];
  }> = [];

  async declareFormula(input: { displayName: string; body: string }): Promise<DeclaredEntry> {
    this.formulas.push({ displayName: input.displayName, body: input.body });
    return { entryId: `entry-${input.displayName}`, displayName: input.displayName, revision: 1 };
  }

  async declareTable(input: {
    displayName: string;
    fields: readonly string[];
    rows: readonly (readonly unknown[])[];
  }): Promise<DeclaredEntry> {
    this.tables.push({ displayName: input.displayName, fields: input.fields, rows: input.rows });
    return { entryId: `entry-${input.displayName}`, displayName: input.displayName, revision: 1 };
  }
}

const ORDERS: FormulaValue = makeTable(
  ["repId", "region", "amount", "status"],
  [
    [makeText("r1"), makeText("north"), num(100), makeText("closed")],
    [makeText("r1"), makeText("north"), num(50), makeText("closed")],
    [makeText("r2"), makeText("south"), num(70), makeText("open")],
    [makeText("r2"), makeText("south"), num(30), makeText("closed")]
  ]
);

const REPS: FormulaValue = makeTable(
  ["id", "name"],
  [[makeText("r1"), makeText("Ada")], [makeText("r2"), makeText("Grace")]]
);

const entries = (): Entry[] => [
  { entryId: "e-orders", displayName: "Orders", revision: 3, value: ORDERS },
  { entryId: "e-reps", displayName: "Reps", revision: 1, value: REPS }
];

interface Harness {
  readonly service: ReturnType<typeof createStructuredAnalyticService>;
  readonly project: FakeProjectData;
  readonly writer: FakeWriter;
  readonly store: SQLiteStructuredAnalyticStore;
  readonly logger: CapturingLogger;
}

const harness = (project = new FakeProjectData(entries())): Harness => {
  const path = join(mkdtempSync(join(tmpdir(), "icarus-sa-service-")), "analytics.db");
  const logger = new CapturingLogger();
  const store = new SQLiteStructuredAnalyticStore(path, "project-1", logger);
  opened.push(store);
  const writer = new FakeWriter();

  let clock = 0;
  let ids = 0;
  const service = createStructuredAnalyticService({
    store,
    projectData: project,
    writer,
    formula: createFormulaEngine(TEST_FORMULA_LIMITS, logger),
    limits: DEFAULT_STRUCTURED_ANALYTIC_LIMITS,
    logger,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString(),
    newId: () => `an-${++ids}`,
    userId: "user-1"
  });
  return { service, project, writer, store, logger };
};

/** Total closed revenue by region, as a bar. The reference analytic. */
const definition = (): AnalyticDefinition => ({
  inputs: [{ name: "Orders" }, { name: "Reps" }],
  joins: [{ kind: "left", left: "Orders", right: "Reps",
            on: [{ leftField: "repId", rightField: "id" }] }],
  filters: [{ field: { input: "Orders", field: "status" },
              operator: "equals", value: { kind: "text", value: "closed" } }],
  columns: [{ id: "p1", field: { input: "Orders", field: "region" },
              aggregation: "none", label: "Region" }],
  rows: [{ id: "p2", field: { input: "Orders", field: "amount" },
           aggregation: "sum", label: "Total" }],
  sorts: [{ placementId: "p2", direction: "desc" }],
  display: { kind: "bar" }
});

const create = async (h: Harness, patch: Partial<AnalyticDefinition> = {}) => {
  const result = await h.service.command({
    type: "analytic.create",
    input: { title: "Revenue by region", definition: { ...definition(), ...patch } }
  });
  assert.equal(result.type, "analytic.created");
  return result.analytic;
};

// ─── Commands ─────────────────────────────────────────────────────────────────

test("create validates, compiles, and captures entry ids", async (t) => {
  await t.test("a valid analytic is stored at revision 1", async () => {
    const h = harness();
    const analytic = await create(h);
    assert.equal(analytic.revision, 1);
    assert.equal(analytic.createdBy, "user-1");
    assert.deepEqual(h.store.get(analytic.id), analytic);
  });

  await t.test("entry ids are captured from the project, not the caller", async () => {
    const h = harness();
    const analytic = await create(h);
    assert.deepEqual(
      analytic.definition.inputs.map(input => input.entryId),
      ["e-orders", "e-reps"]
    );
  });

  // A caller-supplied entryId on a name that does not currently resolve would
  // retarget the input to an unrelated entry, and the first pull would then
  // heal the stored name to match. The capture must overwrite, not merge.
  await t.test("a caller-supplied entry id is overwritten and the attempt logged", async () => {
    const h = harness();
    const analytic = await create(h, {
      inputs: [
        { name: "Orders", entryId: "e-somebody-elses" },
        { name: "Reps" }
      ]
    });
    assert.equal(analytic.definition.inputs[0].entryId, "e-orders");
    assert.ok(
      h.logger.entries.some(e => e.message === "structured-analytic.entry-id.overwritten"),
      "an overwritten id must be visible in the log"
    );
  });

  await t.test("an input that resolves to nothing still saves, with no hint", async () => {
    // Definitions stay editable while a source is being rebuilt or renamed.
    const h = harness();
    const analytic = await create(h, {
      inputs: [{ name: "NotYetBuilt" }],
      joins: [],
      columns: [{ id: "p1", field: { input: "NotYetBuilt", field: "x" }, aggregation: "none" }],
      rows: [],
      filters: [],
      sorts: [],
      display: { kind: "table" }
    });
    assert.equal(analytic.definition.inputs[0].entryId, undefined);
  });

  await t.test("a definition that cannot compile is refused before storage", async () => {
    const h = harness();
    // Two unlabelled placements that both produce the column `region`.
    await assert.rejects(
      () => h.service.command({
        type: "analytic.create",
        input: {
          title: "Colliding",
          definition: {
            ...definition(),
            columns: [
              { id: "c1", field: { input: "Orders", field: "region" }, aggregation: "none" },
              { id: "c2", field: { input: "Reps", field: "region" }, aggregation: "none" }
            ],
            rows: [],
            sorts: [],
            display: { kind: "table" }
          }
        }
      }),
      /both produce the column 'region'/
    );
    assert.deepEqual(h.store.list(), [], "nothing was stored");
  });
});

test("update is a compare-and-swap with typed errors", async (t) => {
  await t.test("a matching revision advances and re-captures", async () => {
    const h = harness();
    const first = await create(h);
    const result = await h.service.command({
      type: "analytic.update",
      input: {
        id: first.id,
        expectedRevision: 1,
        title: "Renamed",
        definition: first.definition
      }
    });
    assert.equal(result.type, "analytic.updated");
    assert.equal(result.analytic.revision, 2);
    assert.equal(result.analytic.title, "Renamed");
  });

  await t.test("a stale revision reports what it actually is", async () => {
    const h = harness();
    const first = await create(h);
    await h.service.command({
      type: "analytic.update",
      input: { id: first.id, expectedRevision: 1, title: "A", definition: first.definition }
    });
    await assert.rejects(
      () => h.service.command({
        type: "analytic.update",
        input: { id: first.id, expectedRevision: 1, title: "B", definition: first.definition }
      }),
      (error: unknown) => {
        assert.ok(error instanceof StaleAnalyticRevisionError);
        assert.equal(error.expectedRevision, 1);
        assert.equal(error.actualRevision, 2);
        return true;
      }
    );
  });

  await t.test("updating something absent is a not-found", async () => {
    const h = harness();
    await assert.rejects(
      () => h.service.command({
        type: "analytic.update",
        input: { id: "ghost", expectedRevision: 1, title: "X", definition: definition() }
      }),
      AnalyticNotFoundError
    );
  });
});

test("delete and purge follow the shared retention model", async () => {
  const h = harness();
  const analytic = await create(h);

  const deleted = await h.service.command({
    type: "analytic.delete",
    input: { id: analytic.id, expectedRevision: 1 }
  });
  assert.equal(deleted.type, "analytic.deleted");
  assert.equal(h.store.get(analytic.id), undefined);
  assert.deepEqual(h.store.latestSnapshot(analytic.id), analytic, "final state recoverable");

  const purged = await h.service.command({
    type: "analytic.purge",
    input: { id: analytic.id }
  });
  assert.equal(purged.type, "analytic.purged");
  assert.equal(h.store.latestSnapshot(analytic.id), undefined);
});

// ─── Pull ─────────────────────────────────────────────────────────────────────

test("pull evaluates the analytic against current project data", async (t) => {
  await t.test("it returns fields, rows, display, definition, and a receipt", async () => {
    const h = harness();
    const analytic = await create(h);
    const result = await h.service.query({ type: "analytic.pull", id: analytic.id });
    assert.equal(result.type, "analytic.pull");
    const pull = result.pull;

    // Rows placements first, then Columns — deliberately not the compiled
    // order, which puts GROUP's keys before its aggregates.
    assert.deepEqual(pull.fields.map(field => field.name), ["Total", "Region"]);
    assert.deepEqual(pull.fields.map(field => field.shelf), ["row", "column"]);
    assert.deepEqual(pull.fields.map(field => field.kind), ["number", "text"]);
    assert.deepEqual(pull.fields.map(field => field.aggregation), ["sum", "none"]);

    // north totals 150 and sorts before south's 30.
    assert.equal(pull.rows.length, 2);
    assert.deepEqual(pull.rows[0][1], { kind: "text", value: "north" });
    assert.deepEqual(pull.rows[0][0], { kind: "number", numerator: "150", denominator: "1" });

    assert.equal(pull.display.kind, "bar");
    assert.deepEqual(pull.definition, analytic.definition, "the pills come back with the data");
    assert.equal(pull.analyticRevision, 1);
  });

  await t.test("the receipt reports what the evaluation actually read", async () => {
    const h = harness();
    const analytic = await create(h);
    const result = await h.service.query({ type: "analytic.pull", id: analytic.id });
    assert.equal(result.type, "analytic.pull");

    assert.deepEqual(result.pull.sources, [
      { input: "Orders", name: "Orders", entryId: "e-orders", revision: 3, status: "ok" },
      { input: "Reps", name: "Reps", entryId: "e-reps", revision: 1, status: "ok" }
    ]);
  });

  await t.test("a missing input is a precise failure, not a generic one", async () => {
    const h = harness();
    const analytic = await create(h);
    h.project.entries.splice(0, 1);

    await assert.rejects(
      () => h.service.query({ type: "analytic.pull", id: analytic.id }),
      (error: unknown) => {
        assert.ok(error instanceof AnalyticPullError);
        assert.equal(error.reason, "input_not_found");
        assert.equal(error.input, "Orders");
        return true;
      }
    );
  });

  // "The formula behind Orders is broken" and "there is no Orders" are
  // different problems with different fixes, and one message for both hides
  // which one you have.
  await t.test("a broken upstream entry is distinguished from a missing one", async () => {
    const h = harness();
    const analytic = await create(h);
    h.project.entries[0].issue = { code: "cycle_error", message: "Orders depends on itself" };

    await assert.rejects(
      () => h.service.query({ type: "analytic.pull", id: analytic.id }),
      (error: unknown) => {
        assert.ok(error instanceof AnalyticPullError);
        assert.equal(error.reason, "input_unresolved");
        assert.match(error.message, /depends on itself/);
        return true;
      }
    );
  });

  await t.test("pulling something absent is a not-found", async () => {
    const h = harness();
    await assert.rejects(
      () => h.service.query({ type: "analytic.pull", id: "ghost" }),
      AnalyticNotFoundError
    );
  });
});

test("a renamed source heals without becoming an edit", async (t) => {
  const renamed = async () => {
    const h = harness();
    const analytic = await create(h);
    h.project.entries[0].displayName = "Sales Orders";
    return { h, analytic };
  };

  await t.test("the pull succeeds and reports the rename", async () => {
    const { h, analytic } = await renamed();
    const result = await h.service.query({ type: "analytic.pull", id: analytic.id });
    assert.equal(result.type, "analytic.pull");

    const orders = result.pull.sources.find(source => source.input === "Orders");
    assert.equal(orders?.status, "renamed");
    assert.equal(orders?.name, "Sales Orders", "the receipt names what actually answered");
    assert.equal(result.pull.rows.length, 2, "and the data is still right");
  });

  // Compiling the stored definition before healing would emit an expression
  // naming an entry that no longer exists — so every renamed source would fail
  // to evaluate, which is precisely what the repair exists to prevent.
  await t.test("the healed name is what gets compiled", async () => {
    const { h, analytic } = await renamed();
    await h.service.query({ type: "analytic.pull", id: analytic.id });

    // The LAST compile — `create` compiled the original definition, and taking
    // the first record would assert against that instead of the pull's.
    const compiled = h.logger.entries.filter(
      e => e.message === "structured-analytic.definition.compiled"
    ).at(-1);
    const source = String((compiled?.data as Record<string, unknown>).source);
    // The new name is what gets referenced; the old key is what everything
    // else in the definition still points at, so it must survive as the key.
    assert.match(source, /ASTABLE\(`Sales Orders`, "Orders"\)/);
    assert.equal(source.includes("ASTABLE(Orders,"), false, "the stale name is gone");
    assert.match(source, /leftAs: "Orders"/, "the key still qualifies the columns");
  });

  await t.test("the repair is persisted without advancing the revision", async () => {
    const { h, analytic } = await renamed();
    await h.service.query({ type: "analytic.pull", id: analytic.id });

    const stored = h.store.get(analytic.id);
    assert.equal(stored?.definition.inputs[0].name, "Sales Orders", "healed on disk");
    assert.equal(stored?.revision, 1, "viewing a chart must not invalidate an open editor");
    assert.equal(stored?.updatedAt, analytic.updatedAt, "and must not reorder the catalog");
  });

  // An input's key is `as ?? name`. Healing a name with no `as` would silently
  // rename the handle that every field ref, join side, and ASTABLE coercion
  // points at — the definition would still compile, and a list-valued input
  // would then synthesize a column nothing references.
  await t.test("healing pins the old key as `as`, so the handle does not move", async () => {
    const { h, analytic } = await renamed();
    await h.service.query({ type: "analytic.pull", id: analytic.id });

    const input = h.store.get(analytic.id)?.definition.inputs[0];
    assert.equal(input?.name, "Sales Orders");
    assert.equal(input?.as, "Orders", "the key survives the rename");

    // And the field refs that pointed at it are still correct.
    const refs = h.store.get(analytic.id)?.definition.columns.map(c => c.field.input);
    assert.deepEqual(refs, ["Orders"]);
  });

  await t.test("a second rename does not re-pin, because `as` already holds", async () => {
    const { h, analytic } = await renamed();
    await h.service.query({ type: "analytic.pull", id: analytic.id });
    h.project.entries[0].displayName = "Q4 Orders";
    await h.service.query({ type: "analytic.pull", id: analytic.id });

    const input = h.store.get(analytic.id)?.definition.inputs[0];
    assert.equal(input?.name, "Q4 Orders");
    assert.equal(input?.as, "Orders", "still the original key, not the intermediate name");
  });

  await t.test("a name pointing at a different entry is reported, not refused", async () => {
    // The name is the selector, so it wins — but the caller is looking at data
    // they did not save against, and the receipt says so.
    const h = harness();
    const analytic = await create(h);
    h.project.entries[0] = {
      entryId: "e-orders-v2",
      displayName: "Orders",
      revision: 1,
      value: ORDERS
    };

    const result = await h.service.query({ type: "analytic.pull", id: analytic.id });
    assert.equal(result.type, "analytic.pull");
    const orders = result.pull.sources.find(source => source.input === "Orders");
    assert.equal(orders?.status, "retargeted");
    assert.equal(orders?.entryId, "e-orders-v2");
  });
});

// ─── Check ────────────────────────────────────────────────────────────────────

test("check answers the freshness question without evaluating", async (t) => {
  await t.test("every source reports ok when nothing has moved", async () => {
    const h = harness();
    const analytic = await create(h);
    const result = await h.service.query({ type: "analytic.check", id: analytic.id });
    assert.equal(result.type, "analytic.check");
    assert.deepEqual(result.check.sources.map(source => source.status), ["ok", "ok"]);
    assert.deepEqual(result.check.sources.map(source => source.revision), [3, 1]);
  });

  await t.test("it reads no data — the cheapness is the point", async () => {
    const h = harness();
    const analytic = await create(h);
    let snapshots = 0;
    const original = h.project.snapshot.bind(h.project);
    h.project.snapshot = async () => { snapshots++; return original(); };

    await h.service.query({ type: "analytic.check", id: analytic.id });
    assert.equal(snapshots, 0, "check must not build a resolver snapshot");
  });

  await t.test("a missing source is reported rather than thrown", async () => {
    const h = harness();
    const analytic = await create(h);
    h.project.entries.splice(0, 1);

    const result = await h.service.query({ type: "analytic.check", id: analytic.id });
    assert.equal(result.type, "analytic.check");
    const orders = result.check.sources.find(source => source.input === "Orders");
    assert.equal(orders?.status, "missing");
    assert.equal(orders?.entryId, undefined);
  });

  await t.test("a rename is healed by check too, still without a revision bump", async () => {
    const h = harness();
    const analytic = await create(h);
    h.project.entries[0].displayName = "Sales Orders";

    const result = await h.service.query({ type: "analytic.check", id: analytic.id });
    assert.equal(result.type, "analytic.check");
    assert.equal(result.check.sources[0].status, "renamed");
    assert.equal(h.store.get(analytic.id)?.definition.inputs[0].name, "Sales Orders");
    assert.equal(h.store.get(analytic.id)?.revision, 1);
  });
});

// ─── Save and copy ────────────────────────────────────────────────────────────

test("save writes the compiled formula, and cannot fail on data", async (t) => {
  await t.test("the declared body is the compiled expression", async () => {
    const h = harness();
    const analytic = await create(h);
    const result = await h.service.command({
      type: "analytic.save",
      input: { id: analytic.id, name: "RevenueByRegion" }
    });
    assert.equal(result.type, "analytic.saved");
    assert.equal(h.writer.formulas.length, 1);
    assert.equal(h.writer.formulas[0].displayName, "RevenueByRegion");
    assert.match(h.writer.formulas[0].body, /^DISPLAY\(/);
    assert.match(h.writer.formulas[0].body, /ASTABLE\(Orders, "Orders"\)/);
  });

  await t.test("a broken source does not stop a save", async () => {
    // Nothing is evaluated, so the saved formula starts working when the
    // upstream entry is fixed — no re-save needed.
    const h = harness();
    const analytic = await create(h);
    h.project.entries.splice(0, 1);

    const result = await h.service.command({
      type: "analytic.save",
      input: { id: analytic.id, name: "StillSaves" }
    });
    assert.equal(result.type, "analytic.saved");
  });
});

test("copy freezes the rows it resolved to", async (t) => {
  await t.test("the declared table carries the pull's fields and rows", async () => {
    const h = harness();
    const analytic = await create(h);
    const result = await h.service.command({
      type: "analytic.copy",
      input: { id: analytic.id, name: "RevenueSnapshot" }
    });
    assert.equal(result.type, "analytic.copied");
    assert.equal(result.rowCount, 2);
    assert.equal(h.writer.tables.length, 1);
    assert.deepEqual(h.writer.tables[0].fields, ["Total", "Region"]);
    assert.equal(h.writer.tables[0].rows.length, 2);
  });

  await t.test("a copy fails on data where a save would not", async () => {
    const h = harness();
    const analytic = await create(h);
    h.project.entries.splice(0, 1);

    await assert.rejects(
      () => h.service.command({
        type: "analytic.copy",
        input: { id: analytic.id, name: "CannotFreeze" }
      }),
      AnalyticPullError
    );
    assert.equal(h.writer.tables.length, 0, "nothing was declared");
  });
});

// ─── Retention ────────────────────────────────────────────────────────────────

test("purgeExpired purges every expired analytic", async () => {
  const h = harness();
  const first = await create(h);
  const second = await create(h);
  await h.service.command({ type: "analytic.delete", input: { id: first.id, expectedRevision: 1 } });
  await h.service.command({ type: "analytic.delete", input: { id: second.id, expectedRevision: 1 } });

  const cutoff = new Date(Date.UTC(2027, 0, 1)).toISOString();
  assert.equal(h.service.purgeExpired(cutoff), 2);
  assert.equal(h.store.latestSnapshot(first.id), undefined);
  assert.equal(h.store.latestSnapshot(second.id), undefined);
});

// The scheduler swallows a throw from purgeExpired, so an error that escaped
// would silently stop the sweep for every analytic behind it — and the counts
// would be the only hint. Retiring reused ids makes the natural cause of this
// unreachable, which is exactly why it needs a deliberate test rather than a
// contrived state.
test("one failing purge does not strand the analytics behind it", () => {
  const h = harness();
  const failing = new Set(["an-boom"]);
  const purged: string[] = [];

  const service = createStructuredAnalyticService({
    store: {
      ...h.store,
      expiredDeleted: () => ["an-1", "an-boom", "an-2"],
      purge: (id: string) => {
        if (failing.has(id)) throw new Error("disk on fire");
        purged.push(id);
      },
      pruneHistory: () => 0
    } as never,
    projectData: h.project,
    writer: h.writer,
    formula: createFormulaEngine(TEST_FORMULA_LIMITS, h.logger),
    limits: DEFAULT_STRUCTURED_ANALYTIC_LIMITS,
    logger: h.logger,
    now: () => new Date(Date.UTC(2026, 0, 1)).toISOString(),
    newId: () => "unused",
    userId: "user-1"
  });

  assert.equal(service.purgeExpired("2027-01-01T00:00:00.000Z"), 2);
  assert.deepEqual(purged, ["an-1", "an-2"], "the sweep continued past the failure");

  const reported = h.logger.entries.find(
    e => e.message === "structured-analytic.purge-expired.failed"
  );
  assert.ok(reported, "a swallowed failure must still be visible");
  assert.equal((reported.data as Record<string, unknown>).analyticId, "an-boom");
});
