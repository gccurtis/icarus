// The compiler is the semantics, so these tests are golden expression text.
//
// A golden is worth arguing with: it fails on any change, including harmless
// reformatting. That is the point here. The compiled source is saved to
// Structured Data and read by people, so its shape is part of the contract, and
// a diff that shows exactly what moved is the fastest way to review a compiler
// change. Every golden below is also parsed, and most are evaluated against
// real data — text that looks right but does not run is the failure mode a
// golden alone would miss.

import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPILED_LANGUAGE_VERSION,
  compileDefinition,
  compileToSource
} from "../../src/3-capabilities/structured-analytic/domain/compile.js";
import { AnalyticCompilationError } from "../../src/3-capabilities/structured-analytic/domain/errors.js";
import { DEFAULT_STRUCTURED_ANALYTIC_LIMITS } from "../../src/3-capabilities/structured-analytic/domain/model.js";
import { validateAnalyticDefinition } from "../../src/3-capabilities/structured-analytic/domain/validation.js";
import { createFormulaEngine } from "../../src/0-platform/formula/index.js";
import type {
  FormulaEngine,
  FormulaResolverSnapshot,
  FormulaValue,
  ResolvedFormulaBinding
} from "../../src/0-platform/formula/index.js";
import { makeNumber, makeTable, makeText, NULL_VALUE } from "../../src/0-platform/formula/index.js";
import { normalizeKey } from "../../src/0-platform/formula/resolver.js";
import { fromInt } from "../../src/0-platform/formula/rational.js";
import { CapturingLogger, TEST_FORMULA_LIMITS } from "../helpers/testDoubles.js";

const LIMITS = DEFAULT_STRUCTURED_ANALYTIC_LIMITS;

const engine = (): FormulaEngine =>
  createFormulaEngine(TEST_FORMULA_LIMITS, new CapturingLogger());

/** Validate then compile, which is the order the service uses. */
const compile = (raw: unknown): string =>
  compileToSource(validateAnalyticDefinition(raw, LIMITS));

/** Compiled source must parse; a golden that does not is not a golden. */
const parses = (source: string): void => {
  const parsed = engine().parse({ source, languageVersion: COMPILED_LANGUAGE_VERSION });
  assert.ok(parsed.ok, `compiled source did not parse: ${JSON.stringify(parsed.diagnostics)}`);
};

const golden = (raw: unknown, expected: string): string => {
  const source = compile(raw);
  assert.equal(source, expected);
  parses(source);
  return source;
};

// ─── Evaluation harness ───────────────────────────────────────────────────────

const num = (n: number): FormulaValue => makeNumber(fromInt(BigInt(n)));

/** A resolver snapshot binding display names to table values. */
const snapshot = (
  entries: Record<string, { fields: string[]; rows: FormulaValue[][] }>
): FormulaResolverSnapshot => {
  const bindings = new Map<string, ResolvedFormulaBinding>();
  for (const [displayName, table] of Object.entries(entries)) {
    bindings.set(normalizeKey(displayName), {
      reference: {
        kind: "binding",
        bindingId: `entry-${displayName}`,
        ownerRevision: 1,
        valueDigest: "vd"
      },
      displayName,
      normalizedLookupKey: normalizeKey(displayName),
      value: makeTable(table.fields, table.rows),
      ownerRevision: 1,
      valueDigest: "vd"
    });
  }
  return {
    id: "snapshot-analytic",
    scope: { userId: "test-user", projectId: "test-project" },
    bindings,
    snapshotDigest: "test-digest",
    createdFrom: []
  };
};

const evaluate = (source: string, resolver: FormulaResolverSnapshot) => {
  const formula = engine();
  const parsed = formula.parse({ source, languageVersion: COMPILED_LANGUAGE_VERSION });
  assert.ok(parsed.ok && parsed.value, `parse failed: ${JSON.stringify(parsed.diagnostics)}`);
  const result = formula.evaluate({ expression: parsed.value, resolver });
  assert.ok(
    result.ok && result.value,
    `evaluation failed: ${JSON.stringify(result.diagnostics)}`
  );
  return result.value;
};

// ─── Golden: the design's worked example ──────────────────────────────────────

test("the design's worked example compiles to the expression the design documents", () => {
  golden(
    {
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
      limit: 10,
      display: { kind: "bar" }
    },
    `DISPLAY(
  LIMIT(
    SORT(
      GROUP(
        WHERE(
          JOIN(
            ASTABLE(Orders, "Orders"),
            ASTABLE(Reps, "Reps"),
            { kind: "left", on: [{ left: "repId", right: "id" }], leftAs: "Orders", rightAs: "Reps" }
          ),
          { all: [{ field: "Orders.status", op: "equals", value: "closed" }] }
        ),
        { keys: [{ field: "Orders.region", as: "Region" }], aggregates: [{ as: "Total", field: "Orders.amount", fn: "sum" }] }
      ),
      [{ field: "Total", direction: "desc" }]
    ),
    10
  ),
  "bar"
)`
  );
});

// ─── Golden: the shape of the pipeline ────────────────────────────────────────

test("a single input needs no join, and its fields stay unqualified", () => {
  // With one input there is no JOIN to qualify anything, so a reference is the
  // bare field name. Qualifying it anyway would name a column that ASTABLE
  // never produced.
  golden(
    {
      inputs: [{ name: "Orders" }], joins: [],
      columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    },
    `DISPLAY(
  GROUP(
    ASTABLE(Orders, "Orders"),
    { keys: [{ field: "region", as: "region" }], aggregates: [] }
  ),
  "table"
)`
  );
});

test("a chained join qualifies its left key but not its right", () => {
  // The second JOIN's left operand is the first JOIN's output, which is already
  // prefixed; its right operand is a fresh ASTABLE, which is not. `on` names are
  // resolved against each side before the output is qualified, so the two sides
  // are spelled differently on purpose.
  golden(
    {
      inputs: [{ name: "A" }, { name: "B" }, { name: "C" }],
      joins: [
        { kind: "inner", left: "A", right: "B", on: [{ leftField: "k", rightField: "k" }] },
        { kind: "left", left: "B", right: "C", on: [{ leftField: "j", rightField: "j" }] }
      ],
      columns: [{ id: "c", field: { input: "A", field: "k" }, aggregation: "none" }],
      rows: [{ id: "r", field: { input: "C", field: "v" }, aggregation: "sum" }],
      filters: [], sorts: [], display: { kind: "line" }
    },
    `DISPLAY(
  GROUP(
    JOIN(
      JOIN(
        ASTABLE(A, "A"),
        ASTABLE(B, "B"),
        { kind: "inner", on: [{ left: "k", right: "k" }], leftAs: "A", rightAs: "B" }
      ),
      ASTABLE(C, "C"),
      { kind: "left", on: [{ left: "B.j", right: "j" }], rightAs: "C" }
    ),
    { keys: [{ field: "A.k", as: "k" }], aggregates: [{ as: "v", field: "C.v", fn: "sum" }] }
  ),
  "line"
)`
  );
});

test("a self-join addresses its two sides by their input keys", () => {
  golden(
    {
      inputs: [{ name: "Orders" }, { name: "Orders", as: "Prior" }],
      joins: [{ kind: "inner", left: "Orders", right: "Prior",
                on: [{ leftField: "id", rightField: "priorId" }] }],
      columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
      rows: [{ id: "r", field: { input: "Prior", field: "amount" },
               aggregation: "sum", label: "Prior total" }],
      filters: [], sorts: [], display: { kind: "bar" }
    },
    `DISPLAY(
  GROUP(
    JOIN(
      ASTABLE(Orders, "Orders"),
      ASTABLE(Orders, "Prior"),
      { kind: "inner", on: [{ left: "id", right: "priorId" }], leftAs: "Orders", rightAs: "Prior" }
    ),
    { keys: [{ field: "Orders.region", as: "region" }], aggregates: [{ as: "Prior total", field: "Prior.amount", fn: "sum" }] }
  ),
  "bar"
)`
  );
});

test("no dimensions compiles to AGGREGATE, not GROUP with empty keys", () => {
  // AGGREGATE differs from a keyless GROUP in one way that matters: over an
  // empty input it still returns one row, because a rollup of nothing is a row
  // of empty answers rather than no rows at all.
  golden(
    {
      inputs: [{ name: "Orders" }], joins: [],
      columns: [],
      rows: [{ id: "r", field: { input: "Orders", field: "amount" },
               aggregation: "sum", label: "Total" }],
      filters: [], sorts: [], display: { kind: "table" }
    },
    `DISPLAY(
  AGGREGATE(
    ASTABLE(Orders, "Orders"),
    { aggregates: [{ as: "Total", field: "amount", fn: "sum" }] }
  ),
  "table"
)`
  );
});

test("optional stages are omitted rather than emitted empty", () => {
  const source = compile({
    inputs: [{ name: "Orders" }], joins: [],
    columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
    rows: [], filters: [], sorts: [], display: { kind: "table" }
  });
  assert.equal(source.includes("WHERE"), false, "no filters means no WHERE");
  assert.equal(source.includes("SORT"), false, "no sorts means no SORT");
  assert.equal(source.includes("LIMIT"), false, "no limit means no LIMIT");
  // DISPLAY is always emitted, `table` included: a table that says it is a
  // table is not the same as one that never said anything.
  assert.equal(source.startsWith("DISPLAY("), true);
});

// ─── Golden: literals ─────────────────────────────────────────────────────────

test("every filter operator lowers to its WHERE predicate", () => {
  const ref = { input: "Orders", field: "f" };
  const source = compile({
    inputs: [{ name: "Orders" }], joins: [],
    columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
    rows: [],
    filters: [
      { field: ref, operator: "equals", value: { kind: "text", value: "a" } },
      { field: ref, operator: "notEquals", value: { kind: "null" } },
      { field: ref, operator: "greaterThan", value: { kind: "number", numerator: "1", denominator: "1" } },
      { field: ref, operator: "lessThanOrEqual", value: { kind: "logic", value: false } },
      { field: ref, operator: "in", values: [{ kind: "text", value: "x" }, { kind: "null" }] },
      { field: ref, operator: "contains", value: "urgent", caseSensitive: true },
      { field: ref, operator: "isNull" },
      { field: ref, operator: "isNotNull" }
    ],
    sorts: [], display: { kind: "table" }
  });

  assert.match(source, /\{ all: \[/);
  for (const predicate of [
    `{ field: "f", op: "equals", value: "a" }`,
    `{ field: "f", op: "notEquals", value: null }`,
    `{ field: "f", op: "greaterThan", value: 1 }`,
    `{ field: "f", op: "lessThanOrEqual", value: false }`,
    `{ field: "f", op: "in", values: ["x", null] }`,
    `{ field: "f", op: "contains", value: "urgent", caseSensitive: true }`,
    `{ field: "f", op: "isNull" }`,
    `{ field: "f", op: "isNotNull" }`
  ]) {
    assert.ok(source.includes(predicate), `missing predicate: ${predicate}`);
  }
  parses(source);
});

test("a rational literal stays exact, as a division the engine evaluates", () => {
  const ref = { input: "Orders", field: "f" };
  const withValue = (value: unknown) => compile({
    inputs: [{ name: "Orders" }], joins: [],
    columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
    rows: [], filters: [{ field: ref, operator: "equals", value }],
    sorts: [], display: { kind: "table" }
  });

  // A whole number needs no parentheses; a division does, so it cannot
  // re-associate with anything around it inside a record literal.
  assert.ok(withValue({ kind: "number", numerator: "42", denominator: "1" })
    .includes(`value: 42 }`));
  assert.ok(withValue({ kind: "number", numerator: "-7", denominator: "1" })
    .includes(`value: -7 }`));
  assert.ok(withValue({ kind: "number", numerator: "-7", denominator: "3" })
    .includes(`value: (-7 / 3) }`));
  // One third is not representable as a float, which is the whole reason the
  // literal is a pair rather than a number.
  parses(withValue({ kind: "number", numerator: "1", denominator: "3" }));
});

test("text literals are escaped so the source stays one line and re-reads equal", () => {
  const source = compile({
    inputs: [{ name: "Orders" }], joins: [],
    columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
    rows: [],
    filters: [{
      field: { input: "Orders", field: "note" },
      operator: "contains",
      value: 'say "hi"\\then\nnewline\ttab',
      caseSensitive: false
    }],
    sorts: [], display: { kind: "table" }
  });

  assert.ok(
    source.includes(String.raw`value: "say \"hi\"\\then\nnewline\ttab"`),
    source
  );
  // A raw newline would lex fine but split one line of compiled source into
  // several, which is what makes saved output unreadable.
  assert.equal(source.split("\n").some(line => line.includes("newline\ttab")), false);
  parses(source);

  // And it round-trips: the engine decodes back to exactly what was authored.
  const parsed = engine().parse({ source, languageVersion: COMPILED_LANGUAGE_VERSION });
  assert.ok(parsed.ok && parsed.value);
  assert.ok(parsed.value.source.includes(String.raw`\"hi\"`));
});

test("a name that is not identifier-safe is emitted in backticks", () => {
  // Structured Data cannot create such a name yet, so this is forward-looking:
  // the day that rule relaxes, the compiler already handles it.
  const source = compile({
    inputs: [{ name: "Q3 Orders" }], joins: [],
    columns: [{ id: "c", field: { input: "Q3 Orders", field: "region" }, aggregation: "none" }],
    rows: [], filters: [], sorts: [], display: { kind: "table" }
  });
  assert.ok(source.includes("ASTABLE(`Q3 Orders`, \"Q3 Orders\")"), source);
  parses(source);
});

test("an ordinary name is emitted bare, because readable output is the point", () => {
  const source = compile({
    inputs: [{ name: "Orders" }], joins: [],
    columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
    rows: [], filters: [], sorts: [], display: { kind: "table" }
  });
  assert.ok(source.includes("ASTABLE(Orders, \"Orders\")"));
  assert.equal(source.includes("`"), false);
});

// ─── Compilation failures ─────────────────────────────────────────────────────

test("two placements that would collide on one column are refused at compile", () => {
  // Each placement is individually valid — they conflict only once compiled.
  // Refusing at save beats failing on every pull forever after.
  assert.throws(
    () => compile({
      inputs: [{ name: "A" }, { name: "B" }],
      joins: [{ kind: "inner", left: "A", right: "B", on: [{ leftField: "k", rightField: "k" }] }],
      columns: [
        { id: "c1", field: { input: "A", field: "region" }, aggregation: "none" },
        { id: "c2", field: { input: "B", field: "region" }, aggregation: "none" }
      ],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    }),
    (error: unknown) => {
      assert.ok(error instanceof AnalyticCompilationError);
      assert.match(error.message, /both produce the column 'region'/);
      assert.match(error.message, /c1.*c2/);
      return true;
    }
  );
});

test("a label resolves a collision that source field names would cause", () => {
  const source = compile({
    inputs: [{ name: "A" }, { name: "B" }],
    joins: [{ kind: "inner", left: "A", right: "B", on: [{ leftField: "k", rightField: "k" }] }],
    columns: [
      { id: "c1", field: { input: "A", field: "region" }, aggregation: "none" },
      { id: "c2", field: { input: "B", field: "region" }, aggregation: "none", label: "Rep region" }
    ],
    rows: [], filters: [], sorts: [], display: { kind: "table" }
  });
  assert.ok(source.includes(`{ field: "A.region", as: "region" }`));
  assert.ok(source.includes(`{ field: "B.region", as: "Rep region" }`));
  parses(source);
});

// ─── compileDefinition ────────────────────────────────────────────────────────

test("compileDefinition parses what it emits, and logs both", () => {
  const logger = new CapturingLogger();
  const definition = validateAnalyticDefinition({
    inputs: [{ name: "Orders" }], joins: [],
    columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
    rows: [], filters: [], sorts: [], display: { kind: "table" }
  }, LIMITS);

  const expression = compileDefinition(definition, engine(), logger);
  assert.equal(expression.languageVersion, COMPILED_LANGUAGE_VERSION);
  assert.equal(expression.source, compileToSource(definition));
  assert.ok(expression.root, "a parsed expression carries its AST");

  const entry = logger.entries.find(e => e.message === "structured-analytic.definition.compiled");
  assert.ok(entry, "a compile must be logged");
  assert.equal(entry.detail, "content");
  const data = entry.data as Record<string, unknown>;
  assert.equal(data.source, expression.source);
  assert.deepEqual(data.definition, definition);
  assert.equal(typeof data.sourceBytes, "number");
});

test("a compile failure is logged with the definition that caused it", () => {
  const logger = new CapturingLogger();
  const definition = validateAnalyticDefinition({
    inputs: [{ name: "A" }, { name: "B" }],
    joins: [{ kind: "inner", left: "A", right: "B", on: [{ leftField: "k", rightField: "k" }] }],
    columns: [
      { id: "c1", field: { input: "A", field: "region" }, aggregation: "none" },
      { id: "c2", field: { input: "B", field: "region" }, aggregation: "none" }
    ],
    rows: [], filters: [], sorts: [], display: { kind: "table" }
  }, LIMITS);

  assert.throws(() => compileDefinition(definition, engine(), logger), AnalyticCompilationError);
  const entry = logger.entries.find(
    e => e.message === "structured-analytic.definition.compile-failed"
  );
  assert.ok(entry);
  assert.equal(entry.level, "warn");
  assert.deepEqual((entry.data as Record<string, unknown>).definition, definition);
});

// ─── Evaluation: the compiled source actually runs ────────────────────────────

test("the compiled expression evaluates against real data", async (t) => {
  const orders = {
    fields: ["repId", "region", "amount", "status"],
    rows: [
      [makeText("r1"), makeText("north"), num(100), makeText("closed")],
      [makeText("r1"), makeText("north"), num(50), makeText("closed")],
      [makeText("r2"), makeText("south"), num(70), makeText("open")],
      [makeText("r2"), makeText("south"), num(30), makeText("closed")]
    ] as FormulaValue[][]
  };
  const reps = {
    fields: ["id", "name"],
    rows: [[makeText("r1"), makeText("Ada")], [makeText("r2"), makeText("Grace")]] as FormulaValue[][]
  };

  await t.test("join, filter, group, sort, limit, display end to end", () => {
    const source = compile({
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

    const value = evaluate(source, snapshot({ Orders: orders, Reps: reps }));
    assert.equal(value.value.kind, "table");
    const table = value.value as { table: { fields: string[]; rows: FormulaValue[][] }; display?: string };

    // Rows first then Columns is the *pull* ordering; the compiled table emits
    // GROUP keys before aggregates, which is exactly why the service permutes.
    assert.deepEqual(table.table.fields, ["Region", "Total"]);
    assert.equal(table.table.rows.length, 2);
    assert.deepEqual(
      table.table.rows.map(row => (row[0] as { value: string }).value),
      ["north", "south"],
      "north totals 150 and sorts before south's 30"
    );
    assert.equal(table.display, "bar", "the rendering intent rides on the table");
  });

  await t.test("a rational filter value compares exactly", () => {
    const source = compile({
      inputs: [{ name: "Orders" }], joins: [],
      // 100 > 200/3 and 50 < 200/3, so an inexact comparison would change the answer.
      filters: [{ field: { input: "Orders", field: "amount" }, operator: "greaterThan",
                  value: { kind: "number", numerator: "200", denominator: "3" } }],
      columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
      rows: [{ id: "r", field: { input: "Orders", field: "amount" },
               aggregation: "count", label: "n" }],
      sorts: [], display: { kind: "table" }
    });

    const value = evaluate(source, snapshot({ Orders: orders }));
    const table = value.value as { table: { rows: FormulaValue[][] } };
    // 100 and 70 pass; 50 and 30 do not.
    const counts = table.table.rows.map(row => Number((row[1] as { value: { numerator: bigint } }).value.numerator));
    assert.deepEqual(counts, [1, 1]);
  });

  await t.test("a left join with no match supplies nulls, and grouping keeps them", () => {
    const orphans = {
      fields: ["repId", "amount"],
      rows: [[makeText("r9"), num(5)]] as FormulaValue[][]
    };
    const source = compile({
      inputs: [{ name: "Orders" }, { name: "Reps" }],
      joins: [{ kind: "left", left: "Orders", right: "Reps",
                on: [{ leftField: "repId", rightField: "id" }] }],
      columns: [{ id: "c", field: { input: "Reps", field: "name" }, aggregation: "none" }],
      rows: [{ id: "r", field: { input: "Orders", field: "amount" },
               aggregation: "sum", label: "Total" }],
      filters: [], sorts: [], display: { kind: "table" }
    });

    const value = evaluate(source, snapshot({ Orders: orphans, Reps: reps }));
    const table = value.value as { table: { rows: FormulaValue[][] } };
    assert.equal(table.table.rows.length, 1);
    assert.deepEqual(table.table.rows[0][0], NULL_VALUE, "no matching rep leaves a null name");
  });

  await t.test("a dimensions-only definition is a distinct", () => {
    const source = compile({
      inputs: [{ name: "Orders" }], joins: [],
      columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    });
    const value = evaluate(source, snapshot({ Orders: orders }));
    const table = value.value as { table: { rows: FormulaValue[][] } };
    assert.equal(table.table.rows.length, 2, "four rows, two distinct regions");
  });

  await t.test("LIMIT truncates after sorting, not before", () => {
    const source = compile({
      inputs: [{ name: "Orders" }], joins: [],
      columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none" }],
      rows: [{ id: "r", field: { input: "Orders", field: "amount" },
               aggregation: "sum", label: "Total" }],
      sorts: [{ placementId: "r", direction: "asc" }],
      limit: 1,
      filters: [], display: { kind: "table" }
    });
    const value = evaluate(source, snapshot({ Orders: orders }));
    const table = value.value as { table: { rows: FormulaValue[][] } };
    assert.equal(table.table.rows.length, 1);
    // south totals 100, north 150 — ascending keeps south.
    assert.equal((table.table.rows[0][0] as { value: string }).value, "south");
  });
});
