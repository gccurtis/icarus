import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createFormulaNameResolver } from "../../src/1-init/create/formula-name-resolver.js";
import { createFormulaEngine } from "../../src/0-platform/formula/engine.js";
import { normalizeKey } from "../../src/0-platform/formula/resolver.js";
import { toWire } from "../../src/0-platform/formula/wire.js";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import { createStructuredData } from "../../src/3-capabilities/structured-data/structured-data.js";
import { SQLiteDataStore } from "../../src/3-capabilities/structured-data/sqlite-store.js";
import {
  DataEntryNotFoundError,
  StaleDataRevisionError
} from "../../src/3-capabilities/structured-data/types.js";
import { registerStructuredDataEndpoints } from "../../src/4-job-wiring/structured-data/registerStructuredDataEndpoints.js";
import { CapturingLogger, TEST_FORMULA_LIMITS } from "../helpers/testDoubles.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "../../src/0-utils/persistence/resourceHistory.js";

const databasePath = (name: string): string =>
  join(mkdtempSync(join(tmpdir(), `icarus-${name}-`)), "test.db");

const createHarness = () => {
  const logger = new CapturingLogger();
  const formula = createFormulaEngine(TEST_FORMULA_LIMITS, logger);
  const store = new SQLiteDataStore("test-project", databasePath("structured-data"));
  const data = createStructuredData(
    store,
    {
      maxDisplayNameBytes: 256,
      maxEntries: 100,
      maxFieldsPerCollection: 20,
      maxRowsPerCollection: 100,
      maxBodyBytes: 65_536
    },
    logger
  );
  const resolver = createFormulaNameResolver(formula, data, logger, {
    userId: "test-user",
    projectId: "test-project"
  });
  return { data, formula, logger, resolver, store };
};

test("Formula resolution reads only the Structured Data instance composed into its resolver", async () => {
  const { data, resolver } = createHarness();
  const unrelatedData = createStructuredData(
    new SQLiteDataStore("test-project", databasePath("unrelated-structured-data")),
    {
      maxDisplayNameBytes: 256,
      maxEntries: 100,
      maxFieldsPerCollection: 20,
      maxRowsPerCollection: 100,
      maxBodyBytes: 65_536
    },
    new CapturingLogger()
  );

  await unrelatedData.declare({
    kind: "variable",
    displayName: "answer",
    body: "99"
  });
  await data.declare({ kind: "variable", displayName: "answer", body: "40 + 2" });

  const snapshot = await resolver.buildSnapshot();
  const binding = snapshot.bindings.get(normalizeKey("answer"));

  assert.ok(binding);
  assert.deepEqual(toWire(binding.value), {
    kind: "number",
    numerator: "42",
    denominator: "1"
  });
});

test("Structured Data rejects display names that collide under Formula's case-insensitive lookup", async () => {
  const { data } = createHarness();
  await data.declare({ kind: "variable", displayName: "Revenue", body: "1" });

  await assert.rejects(
    data.declare({ kind: "variable", displayName: "revenue", body: "2" }),
    /already exists/i
  );
});

test("Structured Data archives revisions, hides logical deletion, and supports guarded purge", async () => {
  const { data, resolver, store } = createHarness();
  const entry = await data.declare({ kind: "variable", displayName: "temporary", body: "1" });
  const updated = await data.updateDescription({
    id: entry.id,
    description: "new revision",
    expectedRevision: entry.revision
  });

  await assert.rejects(
    data.delete({ id: entry.id, expectedRevision: entry.revision }),
    error => error instanceof StaleDataRevisionError
  );
  await assert.rejects(() => data.purge(entry.id), ResourceNotDeletedError);
  assert.deepEqual(store.history(entry.id).map((record) => [record.revision, record.recordType]), [
    [1, "snapshot"]
  ]);

  await data.delete({ id: entry.id, expectedRevision: updated.revision });

  assert.equal(await data.get(entry.id), undefined);
  assert.deepEqual(await data.list(), []);
  assert.equal((await resolver.buildSnapshot()).bindings.has(normalizeKey("temporary")), false);
  assert.deepEqual(store.history(entry.id).map((record) => [record.revision, record.recordType]), [
    [1, "snapshot"],
    [2, "snapshot"],
    [3, "deleted"]
  ]);
  await assert.rejects(
    data.delete({ id: entry.id, expectedRevision: updated.revision }),
    error => error instanceof DataEntryNotFoundError
  );

  await data.purge(entry.id);
  assert.deepEqual(store.history(entry.id), []);
  await assert.rejects(() => data.purge(entry.id), ResourceHistoryNotFoundError);
});

test("Structured Data delete endpoint forwards expectedRevision and maps stale revisions", async () => {
  const { data, formula, logger, resolver } = createHarness();
  const entry = await data.declare({ kind: "variable", displayName: "httpDelete", body: "1" });
  const updated = await data.updateDescription({
    id: entry.id,
    description: "updated",
    expectedRevision: entry.revision
  });
  const registry = new JobRegistry();
  registerStructuredDataEndpoints(registry, data, formula, resolver, logger);

  const makeDeleteJob = (expectedRevision: number) => registry.createJob({
    method: "DELETE",
    path: "/structured-data",
    params: {},
    query: {},
    headers: {},
    body: { id: entry.id, expectedRevision }
  });
  const staleJob = makeDeleteJob(entry.revision);
  assert.equal(staleJob.responseMode, "inline");
  if (staleJob.responseMode !== "inline") throw new Error("Expected inline delete job");
  const staleResponse = await staleJob.work();
  assert.equal(staleResponse.statusCode, 409);
  assert.equal((staleResponse.body as { error: string }).error, "stale_revision");

  const currentJob = makeDeleteJob(updated.revision);
  assert.equal(currentJob.responseMode, "inline");
  if (currentJob.responseMode !== "inline") throw new Error("Expected inline delete job");
  assert.equal((await currentJob.work()).statusCode, 204);
});

test("SQLite update CAS rejects a second store's stale revision", async () => {
  const path = databasePath("structured-data-cas");
  const ownerId = "shared-project";
  const firstStore = new SQLiteDataStore(ownerId, path);
  const secondStore = new SQLiteDataStore(ownerId, path);
  const config = {
    maxDisplayNameBytes: 256,
    maxEntries: 100,
    maxFieldsPerCollection: 20,
    maxRowsPerCollection: 100,
    maxBodyBytes: 65_536
  };
  const firstData = createStructuredData(firstStore, config, new CapturingLogger());
  const secondData = createStructuredData(secondStore, config, new CapturingLogger());
  const declared = await firstData.declare({
    kind: "variable",
    displayName: "sharedValue",
    body: "1"
  });
  const firstSnapshot = firstStore.getEntry(declared.id);
  const secondSnapshot = secondStore.getEntry(declared.id);
  assert.ok(firstSnapshot && secondSnapshot);

  const firstUpdated = {
    ...firstSnapshot,
    description: "winner",
    revision: firstSnapshot.revision + 1,
    updatedAt: new Date().toISOString()
  };
  const secondUpdated = {
    ...secondSnapshot,
    description: "loser",
    revision: secondSnapshot.revision + 1,
    updatedAt: new Date().toISOString()
  };
  assert.equal(firstStore.update(firstUpdated, declared.revision), true);
  assert.equal(secondStore.update(secondUpdated, declared.revision), false);
  assert.equal(
    secondStore.delete(declared.id, declared.revision, new Date().toISOString()),
    undefined
  );

  await assert.rejects(
    secondData.updateDescription({
      id: declared.id,
      description: "also stale",
      expectedRevision: declared.revision
    }),
    error => error instanceof StaleDataRevisionError
      && error.currentRevision === declared.revision + 1
  );
  assert.equal((await firstData.get(declared.id))?.description, "winner");
});

test("collection cell formulas can resolve variables from the same Structured Data snapshot", async () => {
  const { data, resolver } = createHarness();
  await data.declare({ kind: "variable", displayName: "taxRate", body: "7" });
  await data.declare({
    kind: "table",
    displayName: "invoice",
    schema: [{ name: "tax", kind: "number" }],
    rows: [{ tax: { formula: "taxRate" } }]
  });

  const snapshot = await resolver.buildSnapshot();
  const table = snapshot.bindings.get(normalizeKey("invoice"));

  assert.ok(table);
  assert.deepEqual(toWire(table.value), {
    kind: "table",
    fields: ["tax"],
    rows: [[{ kind: "number", numerator: "7", denominator: "1" }]]
  });
});

test("Structured Data variables and functions can use Formula built-ins and lambda parameters", async () => {
  const { data, resolver } = createHarness();
  await data.declare({
    kind: "variable",
    displayName: "total",
    body: "SUM([1, 2])"
  });
  await data.declare({
    kind: "function",
    displayName: "increment",
    body: "LAMBDA(x, x + 1)"
  });
  await data.declare({
    kind: "function",
    displayName: "applyIf",
    body: "LAMBDA(IF, IF(true))"
  });
  await data.declare({
    kind: "variable",
    displayName: "localIf",
    body: "applyIf(LAMBDA(value, value))"
  });

  const snapshot = await resolver.buildSnapshot();
  const total = snapshot.bindings.get(normalizeKey("total"));
  const increment = snapshot.bindings.get(normalizeKey("increment"));
  const localIf = snapshot.bindings.get(normalizeKey("localIf"));

  assert.ok(total);
  assert.deepEqual(toWire(total.value), {
    kind: "number",
    numerator: "3",
    denominator: "1"
  });
  assert.equal(increment?.value.kind, "function");
  assert.equal(localIf?.value.kind, "logic");
  if (localIf?.value.kind === "logic") assert.equal(localIf.value.value, true);
});

test("Formula gives function evaluations identity digests and keeps them off the wire", async () => {
  const { formula, resolver } = createHarness();
  const snapshot = await resolver.buildSnapshot();
  const first = formula.parse({ source: "LAMBDA(x, x + 1)", languageVersion: "formula/v1" });
  const second = formula.parse({ source: "LAMBDA(x, x + 2)", languageVersion: "formula/v1" });
  assert.ok(first.ok && first.value && second.ok && second.value);

  const firstEvaluation = formula.evaluate({ expression: first.value, resolver: snapshot });
  const secondEvaluation = formula.evaluate({ expression: second.value, resolver: snapshot });
  assert.ok(firstEvaluation.ok && firstEvaluation.value);
  assert.ok(secondEvaluation.ok && secondEvaluation.value);
  assert.notEqual(firstEvaluation.value.evaluationDigest, secondEvaluation.value.evaluationDigest);
  assert.throws(
    () => toWire(firstEvaluation.value.value),
    /not wire-serializable/i
  );
});

test("lambda identity includes canonical scalar and nested function captures", async () => {
  const { data, resolver } = createHarness();
  await data.declare({
    kind: "function",
    displayName: "closureFactory",
    body: "LAMBDA(captured, LAMBDA(value, captured))"
  });
  await data.declare({ kind: "variable", displayName: "scalarOne", body: "closureFactory(1)" });
  await data.declare({ kind: "variable", displayName: "scalarTwo", body: "closureFactory(2)" });
  await data.declare({
    kind: "variable",
    displayName: "nestedOne",
    body: "closureFactory(LAMBDA(x, x + 1))"
  });
  await data.declare({
    kind: "variable",
    displayName: "nestedSame",
    body: "closureFactory(LAMBDA(x, x + 1))"
  });
  await data.declare({
    kind: "variable",
    displayName: "nestedDifferent",
    body: "closureFactory(LAMBDA(x, x + 2))"
  });

  const snapshot = await resolver.buildSnapshot();
  const lambdaDigest = (name: string): string => {
    const value = snapshot.bindings.get(normalizeKey(name))?.value;
    assert.equal(value?.kind, "function");
    if (value?.kind !== "function" || value.fn.kind !== "lambda") {
      throw new Error(`Expected ${name} to resolve to a lambda`);
    }
    return value.fn.identityDigest;
  };

  assert.notEqual(lambdaDigest("scalarOne"), lambdaDigest("scalarTwo"));
  assert.equal(lambdaDigest("nestedOne"), lambdaDigest("nestedSame"));
  assert.notEqual(lambdaDigest("nestedOne"), lambdaDigest("nestedDifferent"));
});

test("Formula built-ins are reserved and cannot be shadowed by Structured Data casing", async () => {
  const { data, formula, resolver } = createHarness();

  await assert.rejects(
    data.declare({ kind: "variable", displayName: "sUm", body: "99" }),
    /reserved by Formula/i
  );
  const parsed = formula.parse({ source: "SUM([1, 2])", languageVersion: "formula/v1" });
  assert.ok(parsed.ok && parsed.value);
  const evaluated = formula.evaluate({
    expression: parsed.value,
    resolver: await resolver.buildSnapshot()
  });
  assert.ok(evaluated.ok && evaluated.value?.value.kind === "number");
  assert.equal(evaluated.value.value.value.numerator, 3n);
});

test("resolver progress is bounded by entry count rather than an arbitrary pass cap", async () => {
  const { data, resolver } = createHarness();
  const chainLength = 40;
  for (let index = 0; index < chainLength; index += 1) {
    const displayName = `value${String(index).padStart(2, "0")}`;
    const nextName = `value${String(index + 1).padStart(2, "0")}`;
    await data.declare({
      kind: "variable",
      displayName,
      body: index === chainLength - 1 ? "1" : `${nextName} + 1`
    });
  }

  const snapshot = await resolver.buildSnapshot();
  const first = snapshot.bindings.get(normalizeKey("value00"));
  assert.equal(first?.value.kind, "number");
  if (first?.value.kind === "number") {
    assert.equal(first.value.value.numerator, BigInt(chainLength));
  }
});

test("Formula rejects evaluated output that exceeds maxCells", async () => {
  const { formula, resolver } = createHarness();
  const parsed = formula.parse({ source: "[1, 2]", languageVersion: "formula/v1" });
  assert.ok(parsed.ok && parsed.value);

  const evaluated = formula.evaluate({
    expression: parsed.value,
    resolver: await resolver.buildSnapshot(),
    limits: { maxCells: 1 }
  });

  assert.equal(evaluated.ok, false);
  assert.ok(
    evaluated.diagnostics?.some(
      diagnostic => diagnostic.code === "limit_exceeded"
        && diagnostic.details?.limitName === "maxCells"
    )
  );
});

test("Formula rejects evaluated output that exceeds maxOutputBytes", async () => {
  const { formula, resolver } = createHarness();
  const parsed = formula.parse({ source: '"payload"', languageVersion: "formula/v1" });
  assert.ok(parsed.ok && parsed.value);

  const evaluated = formula.evaluate({
    expression: parsed.value,
    resolver: await resolver.buildSnapshot(),
    limits: { maxOutputBytes: 1 }
  });

  assert.equal(evaluated.ok, false);
  assert.ok(
    evaluated.diagnostics?.some(
      diagnostic => diagnostic.code === "limit_exceeded"
        && diagnostic.details?.limitName === "maxOutputBytes"
    )
  );
});

test("rename makes an old bound Formula reference stale and never retargets it to a new owner", async () => {
  const { data, formula, resolver } = createHarness();
  const original = await data.declare({
    kind: "variable",
    displayName: "rate",
    body: "1"
  });
  const firstSnapshot = await resolver.buildSnapshot();
  const parsed = formula.parse({ source: "rate", languageVersion: "formula/v1" });
  assert.ok(parsed.ok && parsed.value);
  const validated = formula.validate({ expression: parsed.value, resolver: firstSnapshot });
  assert.ok(validated.ok && validated.value?.valid);

  await data.rename({
    id: original.id,
    newDisplayName: "oldRate",
    expectedRevision: original.revision
  });
  await data.declare({ kind: "variable", displayName: "rate", body: "2" });
  const secondSnapshot = await resolver.buildSnapshot();
  const evaluated = formula.evaluate({
    expression: validated.value.expression,
    resolver: secondSnapshot
  });

  assert.equal(evaluated.ok, false);
  assert.ok(evaluated.diagnostics?.some((diagnostic) => diagnostic.code === "stale_binding"));
});

test("resolver snapshot digest changes when the same name and value get a new owner", async () => {
  const { data, formula, resolver } = createHarness();
  const parsedClosure = formula.parse({
    source: "LAMBDA(value, recreated + value)",
    languageVersion: "formula/v1"
  });
  assert.ok(parsedClosure.ok && parsedClosure.value);
  const firstOwner = await data.declare({
    kind: "variable",
    displayName: "recreated",
    body: "1"
  });
  const firstSnapshot = await resolver.buildSnapshot();
  const firstBinding = firstSnapshot.bindings.get(normalizeKey("recreated"));
  assert.ok(firstBinding);
  const firstClosure = formula.evaluate({
    expression: parsedClosure.value,
    resolver: firstSnapshot
  });
  assert.ok(firstClosure.ok && firstClosure.value?.value.kind === "function");

  await data.delete({ id: firstOwner.id, expectedRevision: firstOwner.revision });
  const secondOwner = await data.declare({
    kind: "variable",
    displayName: "recreated",
    body: "1"
  });
  const secondSnapshot = await resolver.buildSnapshot();
  const secondBinding = secondSnapshot.bindings.get(normalizeKey("recreated"));
  assert.ok(secondBinding);
  const secondClosure = formula.evaluate({
    expression: parsedClosure.value,
    resolver: secondSnapshot
  });
  assert.ok(secondClosure.ok && secondClosure.value?.value.kind === "function");

  assert.notEqual(firstOwner.id, secondOwner.id);
  assert.equal(firstBinding.valueDigest, secondBinding.valueDigest);
  assert.notEqual(firstSnapshot.snapshotDigest, secondSnapshot.snapshotDigest);
  const firstFunction = firstClosure.value.value;
  const secondFunction = secondClosure.value.value;
  if (
    firstFunction.kind !== "function" || firstFunction.fn.kind !== "lambda" ||
    secondFunction.kind !== "function" || secondFunction.fn.kind !== "lambda"
  ) {
    throw new Error("Expected captured closures to evaluate to lambdas");
  }
  assert.notEqual(firstFunction.fn.identityDigest, secondFunction.fn.identityDigest);
});

test("failed declarations remain typed resolver issues instead of becoming null bindings", async () => {
  const { data, resolver } = createHarness();
  const broken = await data.declare({
    kind: "variable",
    displayName: "broken",
    body: "1 / 0"
  });

  const snapshot = await resolver.buildSnapshot();

  assert.equal(snapshot.bindings.has(normalizeKey("broken")), false);
  assert.equal(resolver.getIssue(broken.id)?.code, "evaluation_error");
  assert.ok(
    resolver.getIssue(broken.id)?.diagnostics.some(
      diagnostic => diagnostic.code === "divide_by_zero"
    )
  );
});

test("Structured Data validates collection shape and rejects unsupported cells at ingress", async () => {
  const { data } = createHarness();

  await assert.rejects(
    data.declare({
      kind: "record",
      displayName: "invalidRecord",
      schema: [{ name: "value", kind: "number" }],
      rows: []
    }),
    /exactly one row/i
  );
  await assert.rejects(
    data.declare({
      kind: "table",
      displayName: "invalidTable",
      schema: [{ name: "value", kind: "number" }],
      rows: [{ value: { nested: true } as never }]
    }),
    /formula cells must contain only a formula string/i
  );
  await assert.rejects(
    data.declare({
      kind: "table",
      displayName: "unsupportedDate",
      schema: [{ name: "created", kind: "date" }],
      rows: []
    }),
    /unsupported field kind/i
  );
});

test("Structured Data rejects schema replacement that invalidates retained rows", async () => {
  const { data } = createHarness();
  const table = await data.declare({
    kind: "table",
    displayName: "typedRows",
    schema: [{ name: "value", kind: "number" }],
    rows: [{ value: 1 }]
  });

  await assert.rejects(
    data.replaceSchema({
      id: table.id,
      schema: [{ name: "value", kind: "text" }],
      expectedRevision: table.revision
    }),
    /expected text, received number/i
  );
  assert.equal((await data.get(table.id))?.revision, table.revision);
});
