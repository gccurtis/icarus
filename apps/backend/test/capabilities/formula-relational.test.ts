import assert from "node:assert/strict";
import test from "node:test";
import { createFormulaEngine } from "../../src/0-platform/formula/engine.js";
import type { FormulaEngine } from "../../src/0-platform/formula/engine.js";
import { normalizeKey } from "../../src/0-platform/formula/resolver.js";
import type {
  FormulaResolverSnapshot,
  ResolvedFormulaBinding
} from "../../src/0-platform/formula/resolver.js";
import type { FormulaValue } from "../../src/0-platform/formula/value.js";
import { makeNumber, makeRecord, makeText, makeTable } from "../../src/0-platform/formula/value.js";
import { fromInt } from "../../src/0-platform/formula/rational.js";
import { fromWire, toWire } from "../../src/0-platform/formula/wire.js";
import type { FormulaWireValue } from "../../src/0-platform/formula/wire.js";
import { isBuiltinName } from "../../src/0-platform/formula/builtins.js";
import { formulaValueDigest } from "../../src/0-platform/formula/value-identity.js";
import { validateDisplayName } from "../../src/3-capabilities/structured-data/validation.js";
import { decodeRichTextOperation } from "../../src/3-capabilities/document/wire/valueSchemas.js";
import { CapturingLogger, TEST_FORMULA_LIMITS } from "../helpers/testDoubles.js";

// ─── Harness ──────────────────────────────────────────────────────────────────

const emptySnapshot = (
  bindings: ReadonlyMap<string, ResolvedFormulaBinding> = new Map()
): FormulaResolverSnapshot => ({
  id: "snapshot-test",
  scope: { userId: "test-user", projectId: "test-project" },
  bindings,
  snapshotDigest: "test-digest",
  createdFrom: []
});

const binding = (displayName: string, value: FormulaValue): ResolvedFormulaBinding => ({
  reference: { kind: "binding", bindingId: `entry-${displayName}`, ownerRevision: 1, valueDigest: "vd" },
  displayName,
  normalizedLookupKey: normalizeKey(displayName),
  value,
  ownerRevision: 1,
  valueDigest: "vd"
});

const engine = (): FormulaEngine => createFormulaEngine(TEST_FORMULA_LIMITS, new CapturingLogger());

/** Evaluate a source expression, asserting it parses and evaluates cleanly. */
const evaluate = (
  source: string,
  snapshot: FormulaResolverSnapshot = emptySnapshot()
): FormulaValue => {
  const formula = engine();
  const parsed = formula.parse({ source, languageVersion: "formula/v1" });
  assert.ok(parsed.ok, `parse failed: ${JSON.stringify(parsed.diagnostics)}`);
  const evaluated = formula.evaluate({ expression: parsed.value, resolver: snapshot });
  assert.ok(evaluated.ok, `evaluate failed: ${JSON.stringify(evaluated.diagnostics)}`);
  return evaluated.value.value;
};

/** The wire form of a result, which is the most readable thing to assert on. */
const wireOf = (source: string, snapshot?: FormulaResolverSnapshot): FormulaWireValue =>
  toWire(evaluate(source, snapshot));

/** Diagnostic codes from either the parse or the evaluate stage. */
const codesOf = (source: string, snapshot: FormulaResolverSnapshot = emptySnapshot()): string[] => {
  const formula = engine();
  const parsed = formula.parse({ source, languageVersion: "formula/v1" });
  if (!parsed.ok) return (parsed.diagnostics ?? []).map(d => d.code);
  const evaluated = formula.evaluate({ expression: parsed.value, resolver: snapshot });
  if (evaluated.ok) return [];
  return (evaluated.diagnostics ?? []).map(d => d.code);
};

/** Rows as plain JS, so assertions read as data rather than as wire records. */
const rowsOf = (source: string, snapshot?: FormulaResolverSnapshot): unknown[][] => {
  const value = wireOf(source, snapshot);
  assert.ok(value.kind === "list" || value.kind === "record" || value.kind === "table");
  return value.rows.map(row =>
    row.map(cell => {
      switch (cell.kind) {
        case "null": return null;
        case "number": return cell.denominator === "1" ? Number(cell.numerator) : `${cell.numerator}/${cell.denominator}`;
        case "text": return cell.value;
        case "logic": return cell.value;
        default: return "<nested>";
      }
    })
  );
};

const fieldsOf = (source: string, snapshot?: FormulaResolverSnapshot): readonly string[] => {
  const value = wireOf(source, snapshot);
  assert.ok(value.kind === "list" || value.kind === "record" || value.kind === "table");
  return value.fields;
};

// Two small tables used across the join and filter suites.
const ORDERS = `TABLE(
  {region: "west", amount: 10, repId: 1, status: "closed"},
  {region: "east", amount: 20, repId: 2, status: "open"},
  {region: "west", amount: 30, repId: 1, status: "closed"}
)`;
const REPS = `TABLE({id: 1, name: "ada"}, {id: 2, name: "grace"})`;

// ─── ASTABLE ──────────────────────────────────────────────────────────────────

test("ASTABLE normalizes every wire-serializable kind into a table", async (t) => {
  await t.test("a table passes through unchanged", () => {
    assert.deepEqual(fieldsOf(`ASTABLE(${ORDERS}, "Orders")`), ["region", "amount", "repId", "status"]);
    assert.equal(rowsOf(`ASTABLE(${ORDERS}, "Orders")`).length, 3);
  });

  await t.test("a record becomes a one-row table keeping its own field names", () => {
    assert.deepEqual(fieldsOf('ASTABLE({a: 1, b: "x"}, "R")'), ["a", "b"]);
    assert.deepEqual(rowsOf('ASTABLE({a: 1, b: "x"}, "R")'), [[1, "x"]]);
  });

  await t.test("a list becomes one column named for the input, not Formula's 'value'", () => {
    assert.deepEqual(fieldsOf('ASTABLE([10, 20, 30], "Regions")'), ["Regions"]);
    assert.deepEqual(rowsOf('ASTABLE([10, 20, 30], "Regions")'), [[10], [20], [30]]);
  });

  await t.test("a scalar becomes a one-by-one table named for the input", () => {
    assert.deepEqual(fieldsOf('ASTABLE(42, "TargetMargin")'), ["TargetMargin"]);
    assert.deepEqual(rowsOf('ASTABLE(42, "TargetMargin")'), [[42]]);
    assert.deepEqual(rowsOf('ASTABLE("hi", "T")'), [["hi"]]);
    assert.deepEqual(rowsOf('ASTABLE(NULL, "T")'), [[null]]);
  });

  await t.test("a function value is rejected because it cannot cross the wire", () => {
    assert.deepEqual(codesOf('ASTABLE(LAMBDA(x, x), "F")'), ["type_error"]);
  });

  await t.test("the name must be non-empty text", () => {
    assert.deepEqual(codesOf("ASTABLE([1], 5)"), ["type_error"]);
    assert.deepEqual(codesOf('ASTABLE([1], "")'), ["type_error"]);
    assert.deepEqual(codesOf("ASTABLE([1])"), ["wrong_arity"]);
  });
});

// ─── JOIN ─────────────────────────────────────────────────────────────────────

test("JOIN combines two tables on exact equality keys", async (t) => {
  const join = (kind: string, extra = "") => `JOIN(${ORDERS}, ${REPS}, {
    kind: "${kind}", on: [{left: "repId", right: "id"}], leftAs: "O", rightAs: "R"${extra}
  })`;

  await t.test("an inner join qualifies both sides and keeps matching pairs", () => {
    assert.deepEqual(fieldsOf(join("inner")), [
      "O.region", "O.amount", "O.repId", "O.status", "R.id", "R.name"
    ]);
    assert.deepEqual(rowsOf(join("inner")), [
      ["west", 10, 1, "closed", 1, "ada"],
      ["east", 20, 2, "open", 2, "grace"],
      ["west", 30, 1, "closed", 1, "ada"]
    ]);
  });

  await t.test("kind defaults to inner when the option is omitted", () => {
    const defaulted = `JOIN(${ORDERS}, ${REPS}, {
      on: [{left: "repId", right: "id"}], leftAs: "O", rightAs: "R"
    })`;
    assert.deepEqual(rowsOf(defaulted), rowsOf(join("inner")));
  });

  await t.test("a left join with no match supplies null for every right field", () => {
    const orders = 'TABLE({repId: 1}, {repId: 99})';
    const source = `JOIN(${orders}, ${REPS}, {
      kind: "left", on: [{left: "repId", right: "id"}], leftAs: "O", rightAs: "R"
    })`;
    assert.deepEqual(rowsOf(source), [[1, 1, "ada"], [99, null, null]]);
  });

  await t.test("an inner join drops a left row with no match", () => {
    const orders = 'TABLE({repId: 1}, {repId: 99})';
    const source = `JOIN(${orders}, ${REPS}, {
      on: [{left: "repId", right: "id"}], leftAs: "O", rightAs: "R"
    })`;
    assert.deepEqual(rowsOf(source), [[1, 1, "ada"]]);
  });

  await t.test("null never matches null, in either join kind", () => {
    const left = "TABLE({k: NULL}, {k: 1})";
    const right = 'TABLE({k: NULL, tag: "n"}, {k: 1, tag: "one"})';
    const inner = `JOIN(${left}, ${right}, {on: [{left: "k", right: "k"}], leftAs: "L", rightAs: "R"})`;
    assert.deepEqual(rowsOf(inner), [[1, 1, "one"]]);

    const outer = `JOIN(${left}, ${right}, {kind: "left", on: [{left: "k", right: "k"}], leftAs: "L", rightAs: "R"})`;
    assert.deepEqual(rowsOf(outer), [[null, null, null], [1, 1, "one"]]);
  });

  await t.test("many-to-many preserves left order then right source order", () => {
    const left = 'TABLE({k: 1, l: "a"}, {k: 1, l: "b"})';
    const right = 'TABLE({k: 1, r: "x"}, {k: 1, r: "y"})';
    const source = `JOIN(${left}, ${right}, {on: [{left: "k", right: "k"}], leftAs: "L", rightAs: "R"})`;
    assert.deepEqual(rowsOf(source), [
      [1, "a", 1, "x"],
      [1, "a", 1, "y"],
      [1, "b", 1, "x"],
      [1, "b", 1, "y"]
    ]);
  });

  await t.test("logic values are distinct join keys, not one bucket", () => {
    const left = 'TABLE({f: TRUE}, {f: FALSE})';
    const right = 'TABLE({f: TRUE, tag: "yes"})';
    const source = `JOIN(${left}, ${right}, {on: [{left: "f", right: "f"}], leftAs: "L", rightAs: "R"})`;
    assert.deepEqual(rowsOf(source), [[true, true, "yes"]]);
  });

  await t.test("an unknown key field on either side is an unknown_field", () => {
    assert.deepEqual(
      codesOf(`JOIN(${REPS}, ${REPS}, {on: [{left: "id", right: "nope"}], leftAs: "L", rightAs: "R"})`),
      ["unknown_field"]
    );
  });

  await t.test("a non-table argument is a type error on either side", () => {
    assert.deepEqual(codesOf(`JOIN(5, ${REPS}, {on: [{left: "a", right: "id"}]})`), ["type_error"]);
    assert.deepEqual(codesOf(`JOIN(${REPS}, 5, {on: [{left: "id", right: "a"}]})`), ["type_error"]);
  });

  await t.test("multiple keys are ANDed", () => {
    const left = 'TABLE({a: 1, b: "x"}, {a: 1, b: "y"})';
    const right = 'TABLE({a: 1, b: "x", hit: "yes"})';
    const source = `JOIN(${left}, ${right}, {
      on: [{left: "a", right: "a"}, {left: "b", right: "b"}], leftAs: "L", rightAs: "R"
    })`;
    assert.deepEqual(rowsOf(source), [[1, "x", 1, "x", "yes"]]);
  });

  await t.test("equal rationals written differently still match", () => {
    const left = "TABLE({k: 0.5})";
    const right = 'TABLE({k: 1 / 2, tag: "half"})';
    const source = `JOIN(${left}, ${right}, {on: [{left: "k", right: "k"}], leftAs: "L", rightAs: "R"})`;
    assert.deepEqual(rowsOf(source), [["1/2", "1/2", "half"]]);
  });

  await t.test("a chained join prefixes only the newly added side", () => {
    const first = `JOIN(${ORDERS}, ${REPS}, {
      on: [{left: "repId", right: "id"}], leftAs: "O", rightAs: "R"
    })`;
    const regions = 'TABLE({name: "west", lead: "kim"})';
    const chained = `JOIN(${first}, ${regions}, {
      kind: "left", on: [{left: "O.region", right: "name"}], rightAs: "G"
    })`;
    assert.deepEqual(fieldsOf(chained), [
      "O.region", "O.amount", "O.repId", "O.status", "R.id", "R.name", "G.name", "G.lead"
    ]);
    assert.equal(rowsOf(chained).length, 3);
  });

  await t.test("colliding output fields are refused with a fixable message", () => {
    const source = `JOIN(${REPS}, ${REPS}, {on: [{left: "id", right: "id"}]})`;
    assert.deepEqual(codesOf(source), ["invalid_table"]);
  });

  await t.test("an empty or missing 'on' list is refused", () => {
    assert.deepEqual(codesOf(`JOIN(${REPS}, ${REPS}, {on: []})`), ["type_error"]);
    assert.deepEqual(codesOf(`JOIN(${REPS}, ${REPS}, {})`), ["type_error"]);
  });

  await t.test("an unknown key field is an unknown_field diagnostic", () => {
    assert.deepEqual(
      codesOf(`JOIN(${REPS}, ${REPS}, {on: [{left: "nope", right: "id"}]})`),
      ["unknown_field"]
    );
  });

  await t.test("an unknown option is rejected rather than ignored", () => {
    assert.deepEqual(
      codesOf(`JOIN(${REPS}, ${REPS}, {on: [{left: "id", right: "id"}], how: "inner"})`),
      ["type_error"]
    );
  });

  await t.test("an unsupported join kind is refused", () => {
    assert.deepEqual(
      codesOf(`JOIN(${REPS}, ${REPS}, {kind: "full", on: [{left: "id", right: "id"}]})`),
      ["type_error"]
    );
  });

  await t.test("the intermediate product is bounded, not materialised then checked", () => {
    const formula = createFormulaEngine({ ...TEST_FORMULA_LIMITS, maxRows: 3 }, new CapturingLogger());
    const left = "TABLE({k: 1}, {k: 1}, {k: 1})";
    const right = 'TABLE({k: 1, r: "x"}, {k: 1, r: "y"})';
    const source = `JOIN(${left}, ${right}, {on: [{left: "k", right: "k"}], leftAs: "L", rightAs: "R"})`;
    const parsed = formula.parse({ source, languageVersion: "formula/v1" });
    assert.ok(parsed.ok);
    const evaluated = formula.evaluate({ expression: parsed.value, resolver: emptySnapshot() });
    assert.equal(evaluated.ok, false);
    assert.deepEqual((evaluated.diagnostics ?? []).map(d => d.code), ["limit_exceeded"]);
  });
});

// ─── WHERE ────────────────────────────────────────────────────────────────────

test("WHERE filters with the full operator vocabulary", async (t) => {
  const nums = 'TABLE({n: 1, t: "Alpha"}, {n: 2, t: "beta"}, {n: 3, t: NULL})';
  const where = (predicate: string) => `WHERE(${nums}, {all: [${predicate}]})`;

  await t.test("the six comparisons", () => {
    assert.deepEqual(rowsOf(where('{field: "n", op: "equals", value: 2}')).map(r => r[0]), [2]);
    assert.deepEqual(rowsOf(where('{field: "n", op: "notEquals", value: 2}')).map(r => r[0]), [1, 3]);
    assert.deepEqual(rowsOf(where('{field: "n", op: "greaterThan", value: 2}')).map(r => r[0]), [3]);
    assert.deepEqual(rowsOf(where('{field: "n", op: "greaterThanOrEqual", value: 2}')).map(r => r[0]), [2, 3]);
    assert.deepEqual(rowsOf(where('{field: "n", op: "lessThan", value: 2}')).map(r => r[0]), [1]);
    assert.deepEqual(rowsOf(where('{field: "n", op: "lessThanOrEqual", value: 2}')).map(r => r[0]), [1, 2]);
  });

  await t.test("'in' matches any listed value and requires a nonempty list", () => {
    assert.deepEqual(rowsOf(where('{field: "n", op: "in", values: [1, 3]}')).map(r => r[0]), [1, 3]);
    assert.deepEqual(codesOf(where('{field: "n", op: "in", values: []}')), ["type_error"]);
  });

  await t.test("'contains' is literal substring matching, case-insensitive by default", () => {
    assert.deepEqual(rowsOf(where('{field: "t", op: "contains", value: "lph"}')).map(r => r[1]), ["Alpha"]);
    assert.deepEqual(rowsOf(where('{field: "t", op: "contains", value: "ALPH"}')).map(r => r[1]), ["Alpha"]);
    assert.deepEqual(
      rowsOf(where('{field: "t", op: "contains", value: "ALPH", caseSensitive: TRUE}')).map(r => r[1]),
      []
    );
  });

  await t.test("isNull and isNotNull", () => {
    assert.deepEqual(rowsOf(where('{field: "t", op: "isNull"}')).map(r => r[0]), [3]);
    assert.deepEqual(rowsOf(where('{field: "t", op: "isNotNull"}')).map(r => r[0]), [1, 2]);
  });

  await t.test("null passes equality and 'in' but never ordering or contains", () => {
    assert.deepEqual(rowsOf(where('{field: "t", op: "equals", value: NULL}')).map(r => r[0]), [3]);
    assert.deepEqual(rowsOf(where('{field: "t", op: "in", values: [NULL]}')).map(r => r[0]), [3]);
    assert.deepEqual(rowsOf(where('{field: "t", op: "greaterThan", value: "a"}')).map(r => r[0]), [2]);
    assert.deepEqual(rowsOf(where('{field: "t", op: "contains", value: "a"}')).map(r => r[0]), [1, 2]);
  });

  await t.test("comparisons never coerce across kinds", () => {
    assert.deepEqual(rowsOf(where('{field: "n", op: "equals", value: "1"}')).map(r => r[0]), []);
    assert.deepEqual(rowsOf(where('{field: "n", op: "greaterThan", value: "1"}')).map(r => r[0]), []);
  });

  await t.test("'all' is ANDed, 'any' is ORed, and together they are ANDed", () => {
    const both = `WHERE(${nums}, {
      all: [{field: "n", op: "greaterThanOrEqual", value: 1}],
      any: [{field: "n", op: "equals", value: 1}, {field: "n", op: "equals", value: 3}]
    })`;
    assert.deepEqual(rowsOf(both).map(r => r[0]), [1, 3]);
  });

  await t.test("omitting options keeps every row", () => {
    assert.equal(rowsOf(`WHERE(${nums})`).length, 3);
    assert.equal(rowsOf(`WHERE(${nums}, {})`).length, 3);
  });

  await t.test("an unknown field, op, or option is refused", () => {
    assert.deepEqual(codesOf(where('{field: "nope", op: "isNull"}')), ["unknown_field"]);
    assert.deepEqual(codesOf(where('{field: "n", op: "matches", value: 1}')), ["type_error"]);
    assert.deepEqual(codesOf(where('{field: "n", op: "isNull", nope: 1}')), ["type_error"]);
    assert.deepEqual(codesOf(`WHERE(${nums}, {none: []})`), ["type_error"]);
  });
});

// ─── GROUP and AGGREGATE ──────────────────────────────────────────────────────

test("GROUP and AGGREGATE summarise with exact arithmetic", async (t) => {
  const sales = 'TABLE({r: "w", v: 10}, {r: "e", v: 20}, {r: "w", v: 5})';

  await t.test("GROUP keeps first-appearance order and names outputs by 'as'", () => {
    const source = `GROUP(${sales}, {keys: ["r"], aggregates: [{as: "Total", field: "v", fn: "sum"}]})`;
    assert.deepEqual(fieldsOf(source), ["r", "Total"]);
    assert.deepEqual(rowsOf(source), [["w", 15], ["e", 20]]);
  });

  await t.test("GROUP with no aggregates is a distinct over its keys", () => {
    assert.deepEqual(rowsOf(`GROUP(${sales}, {keys: ["r"]})`), [["w"], ["e"]]);
  });

  await t.test("a grouping key can be aliased so its output column carries a label", () => {
    const source = `GROUP(${sales}, {
      keys: [{field: "r", as: "Region"}],
      aggregates: [{as: "Total", field: "v", fn: "sum"}]
    })`;
    assert.deepEqual(fieldsOf(source), ["Region", "Total"]);
    assert.deepEqual(rowsOf(source), [["w", 15], ["e", 20]]);
  });

  await t.test("an aliased key without 'as' keeps its source name", () => {
    assert.deepEqual(fieldsOf(`GROUP(${sales}, {keys: [{field: "r"}]})`), ["r"]);
  });

  await t.test("a bad key record is refused", () => {
    assert.deepEqual(codesOf(`GROUP(${sales}, {keys: [{field: "nope", as: "X"}]})`), ["unknown_field"]);
    assert.deepEqual(codesOf(`GROUP(${sales}, {keys: [{as: "X"}]})`), ["type_error"]);
    assert.deepEqual(codesOf(`GROUP(${sales}, {keys: [{field: "r", nope: 1}]})`), ["type_error"]);
  });

  await t.test("AGGREGATE is the whole-table rollup", () => {
    const source = `AGGREGATE(${sales}, {aggregates: [{as: "Total", field: "v", fn: "sum"}]})`;
    assert.deepEqual(fieldsOf(source), ["Total"]);
    assert.deepEqual(rowsOf(source), [[35]]);
  });

  await t.test("AGGREGATE over an empty table is still one row", () => {
    const empty = 'WHERE(TABLE({v: 1}), {all: [{field: "v", op: "equals", value: 99}]})';
    const source = `AGGREGATE(${empty}, {aggregates: [{as: "T", field: "v", fn: "sum"}, {as: "C", field: "v", fn: "count"}]})`;
    assert.deepEqual(rowsOf(source), [[null, 0]]);
  });

  await t.test("GROUP over an empty table is no rows at all", () => {
    const empty = 'WHERE(TABLE({v: 1}), {all: [{field: "v", op: "equals", value: 99}]})';
    assert.deepEqual(rowsOf(`GROUP(${empty}, {keys: ["v"]})`), []);
  });

  await t.test("average is an exact rational, never a float", () => {
    const thirds = "TABLE({v: 1}, {v: 1}, {v: 2})";
    const source = `AGGREGATE(${thirds}, {aggregates: [{as: "Avg", field: "v", fn: "average"}]})`;
    assert.deepEqual(rowsOf(source), [["4/3"]]);
  });

  await t.test("count counts non-null; sum and average ignore nulls", () => {
    const sparse = "TABLE({v: 10}, {v: NULL}, {v: 30})";
    const source = `AGGREGATE(${sparse}, {aggregates: [
      {as: "C", field: "v", fn: "count"},
      {as: "S", field: "v", fn: "sum"},
      {as: "A", field: "v", fn: "average"}
    ]})`;
    assert.deepEqual(rowsOf(source), [[2, 40, 20]]);
  });

  await t.test("an all-null group yields null for every aggregate but count", () => {
    const nulls = "TABLE({v: NULL}, {v: NULL})";
    const source = `AGGREGATE(${nulls}, {aggregates: [
      {as: "C", field: "v", fn: "count"},
      {as: "S", field: "v", fn: "sum"},
      {as: "M", field: "v", fn: "min"}
    ]})`;
    assert.deepEqual(rowsOf(source), [[0, null, null]]);
  });

  await t.test("min and max accept number or text and stay kind-strict", () => {
    const words = 'TABLE({t: "pear"}, {t: "apple"})';
    assert.deepEqual(
      rowsOf(`AGGREGATE(${words}, {aggregates: [{as: "M", field: "t", fn: "min"}]})`),
      [["apple"]]
    );
    const mixed = 'TABLE({t: "pear"}, {t: 1})';
    assert.deepEqual(
      codesOf(`AGGREGATE(${mixed}, {aggregates: [{as: "M", field: "t", fn: "min"}]})`),
      ["type_error"]
    );
  });

  await t.test("max picks the largest, so a min/max comparator swap is visible", () => {
    const source = `AGGREGATE(${sales}, {aggregates: [
      {as: "Lo", field: "v", fn: "min"},
      {as: "Hi", field: "v", fn: "max"}
    ]})`;
    assert.deepEqual(rowsOf(source), [[5, 20]]);
    const words = 'TABLE({t: "pear"}, {t: "apple"}, {t: "fig"})';
    assert.deepEqual(
      rowsOf(`AGGREGATE(${words}, {aggregates: [{as: "M", field: "t", fn: "max"}]})`),
      [["pear"]]
    );
  });

  await t.test("logic values are distinct group keys, not one bucket", () => {
    const flags = "TABLE({f: TRUE, v: 1}, {f: FALSE, v: 2}, {f: TRUE, v: 3})";
    const source = `GROUP(${flags}, {keys: ["f"], aggregates: [{as: "S", field: "v", fn: "sum"}]})`;
    assert.deepEqual(rowsOf(source), [[true, 4], [false, 2]]);
  });

  await t.test("sum refuses a non-numeric column", () => {
    const words = 'TABLE({t: "pear"})';
    assert.deepEqual(
      codesOf(`AGGREGATE(${words}, {aggregates: [{as: "S", field: "t", fn: "sum"}]})`),
      ["type_error"]
    );
  });

  await t.test("nulls group together, unlike a join key", () => {
    const sparse = 'TABLE({r: NULL, v: 1}, {r: NULL, v: 2}, {r: "w", v: 3})';
    const source = `GROUP(${sparse}, {keys: ["r"], aggregates: [{as: "S", field: "v", fn: "sum"}]})`;
    assert.deepEqual(rowsOf(source), [[null, 3], ["w", 3]]);
  });

  await t.test("bad aggregate specs are refused", () => {
    assert.deepEqual(codesOf(`AGGREGATE(${sales}, {aggregates: []})`), ["type_error"]);
    assert.deepEqual(
      codesOf(`AGGREGATE(${sales}, {aggregates: [{as: "S", field: "v", fn: "median"}]})`),
      ["type_error"]
    );
    assert.deepEqual(
      codesOf(`AGGREGATE(${sales}, {aggregates: [{as: "S", field: "nope", fn: "sum"}]})`),
      ["unknown_field"]
    );
    assert.deepEqual(codesOf(`GROUP(${sales}, {keys: ["nope"]})`), ["unknown_field"]);
    assert.deepEqual(codesOf(`GROUP(${sales}, {keys: [5]})`), ["type_error"]);
    assert.deepEqual(codesOf(`GROUP(${sales}, {keys: ["r"], aggregates: []})`), []);
  });

  await t.test("a duplicate output field is refused", () => {
    assert.deepEqual(
      codesOf(`GROUP(${sales}, {keys: ["r"], aggregates: [{as: "r", field: "v", fn: "sum"}]})`),
      ["invalid_table"]
    );
  });

  await t.test("AGGREGATE does not accept grouping keys", () => {
    assert.deepEqual(codesOf(`AGGREGATE(${sales}, {keys: ["r"]})`), ["type_error"]);
  });
});

// ─── SORT ─────────────────────────────────────────────────────────────────────

test("SORT is stable, kind-strict, and puts nulls last", async (t) => {
  const rows = 'TABLE({k: 2, t: "a"}, {k: 1, t: "b"}, {k: 2, t: "c"}, {k: NULL, t: "d"})';

  await t.test("ascending is the default direction", () => {
    const source = `SORT(${rows}, [{field: "k"}])`;
    assert.deepEqual(rowsOf(source).map(r => r[1]), ["b", "a", "c", "d"]);
  });

  await t.test("equal values keep their prior order", () => {
    const source = `SORT(${rows}, [{field: "k", direction: "asc"}])`;
    assert.deepEqual(rowsOf(source).map(r => r[1]), ["b", "a", "c", "d"]);
  });

  await t.test("null sorts last in both directions", () => {
    const asc = `SORT(${rows}, [{field: "k", direction: "asc"}])`;
    const desc = `SORT(${rows}, [{field: "k", direction: "desc"}])`;
    assert.equal(rowsOf(asc).at(-1)?.[1], "d");
    assert.equal(rowsOf(desc).at(-1)?.[1], "d");
    assert.deepEqual(rowsOf(desc).map(r => r[1]), ["a", "c", "b", "d"]);
  });

  await t.test("multiple keys apply in authored order", () => {
    const two = 'TABLE({a: 1, b: 2}, {a: 1, b: 1}, {a: 0, b: 9})';
    const source = `SORT(${two}, [{field: "a"}, {field: "b"}])`;
    assert.deepEqual(rowsOf(source), [[0, 9], [1, 1], [1, 2]]);
  });

  await t.test("text sorts against text", () => {
    const words = 'TABLE({t: "pear"}, {t: "apple"}, {t: "fig"})';
    assert.deepEqual(rowsOf(`SORT(${words}, [{field: "t"}])`).map(r => r[0]), ["apple", "fig", "pear"]);
  });

  await t.test("a mixed-kind column still orders deterministically", () => {
    const mixed = 'TABLE({v: "b"}, {v: 2}, {v: TRUE}, {v: "a"}, {v: 1})';
    assert.deepEqual(rowsOf(`SORT(${mixed}, [{field: "v"}])`).map(r => r[0]), [1, 2, "a", "b", true]);
  });

  await t.test("a non-scalar sort column is refused rather than silently no-ops", () => {
    const nested = 'TABLE({v: [1, 2]}, {v: [3]})';
    assert.deepEqual(codesOf(`SORT(${nested}, [{field: "v"}])`), ["type_error"]);
  });

  await t.test("equal-and-null on the first key falls through to the second", () => {
    const two = 'TABLE({a: NULL, b: 2}, {a: NULL, b: 1})';
    assert.deepEqual(rowsOf(`SORT(${two}, [{field: "a"}, {field: "b"}])`).map(r => r[1]), [1, 2]);
  });

  await t.test("bad sort specs are refused", () => {
    assert.deepEqual(codesOf(`SORT(${rows}, [{field: "nope"}])`), ["unknown_field"]);
    assert.deepEqual(codesOf(`SORT(${rows}, [{field: "k", direction: "up"}])`), ["type_error"]);
    assert.deepEqual(codesOf(`SORT(${rows}, [{field: "k", desc: TRUE}])`), ["type_error"]);
    assert.deepEqual(codesOf(`SORT(${rows}, {field: "k"})`), ["type_error"]);
  });
});

// ─── LIMIT ────────────────────────────────────────────────────────────────────

test("LIMIT takes the leading rows", async (t) => {
  const rows = "TABLE({v: 1}, {v: 2}, {v: 3})";

  await t.test("it takes exactly n and tolerates n beyond the row count", () => {
    assert.deepEqual(rowsOf(`LIMIT(${rows}, 2)`), [[1], [2]]);
    assert.deepEqual(rowsOf(`LIMIT(${rows}, 99)`), [[1], [2], [3]]);
    assert.deepEqual(rowsOf(`LIMIT(${rows}, 1)`), [[1]]);
  });

  await t.test("zero, negative, and fractional counts are refused", () => {
    assert.deepEqual(codesOf(`LIMIT(${rows}, 0)`), ["type_error"]);
    assert.deepEqual(codesOf(`LIMIT(${rows}, 0 - 1)`), ["type_error"]);
    assert.deepEqual(codesOf(`LIMIT(${rows}, 1.5)`), ["type_error"]);
    assert.deepEqual(codesOf(`LIMIT(${rows}, "2")`), ["type_error"]);
  });
});

// ─── DISPLAY ──────────────────────────────────────────────────────────────────

test("DISPLAY carries rendering intent on the table itself", async (t) => {
  const rows = 'TABLE({r: "w", v: 1})';

  await t.test("the result is still an ordinary table", () => {
    assert.deepEqual(fieldsOf(`DISPLAY(${rows}, "bar")`), ["r", "v"]);
    assert.deepEqual(rowsOf(`DISPLAY(${rows}, "bar")`), [["w", 1]]);
  });

  await t.test("the annotation reaches the wire form", () => {
    const wire = wireOf(`DISPLAY(${rows}, "bar")`);
    assert.equal(wire.kind, "table");
    assert.equal(wire.kind === "table" ? wire.display : undefined, "bar");
  });

  await t.test("a table without DISPLAY carries no annotation", () => {
    const wire = wireOf(rows);
    assert.equal(wire.kind === "table" ? wire.display : "unset", undefined);
  });

  await t.test("it round-trips through fromWire", () => {
    const value = evaluate(`DISPLAY(${rows}, "line")`);
    const restored = fromWire(toWire(value));
    assert.equal(restored.kind, "table");
    assert.equal(restored.kind === "table" ? restored.display : undefined, "line");
  });

  await t.test("a displayed table still feeds every other relational builtin", () => {
    const source = `AGGREGATE(DISPLAY(${rows}, "pie"), {aggregates: [{as: "S", field: "v", fn: "sum"}]})`;
    assert.deepEqual(rowsOf(source), [[1]]);
  });

  await t.test("only the supported kinds are accepted", () => {
    for (const kind of ["table", "bar", "line", "area", "scatter", "pie"]) {
      assert.deepEqual(rowsOf(`DISPLAY(${rows}, "${kind}")`), [["w", 1]]);
    }
    assert.deepEqual(codesOf(`DISPLAY(${rows}, "sankey")`), ["type_error"]);
    assert.deepEqual(codesOf(`DISPLAY(${rows}, 5)`), ["type_error"]);
  });

  await t.test("rendering intent is part of a table's identity", () => {
    const bar = toWire(evaluate(`DISPLAY(${rows}, "bar")`));
    const line = toWire(evaluate(`DISPLAY(${rows}, "line")`));
    assert.notDeepEqual(bar, line);
    assert.notEqual(
      formulaValueDigest(evaluate(`DISPLAY(${rows}, "bar")`)),
      formulaValueDigest(evaluate(`DISPLAY(${rows}, "line")`))
    );
    // ...but a table with no annotation digests exactly as it always did, so
    // no persisted binding digest changes on deploy.
    assert.equal(
      formulaValueDigest(evaluate(rows)),
      formulaValueDigest(fromWire(toWire(evaluate(rows))))
    );
  });

  await t.test("`=` compares data and ignores intent, while identity does not", () => {
    // A deliberate pair: tableEqual sees only fields and rows, the digest sees
    // the annotation too. Pinned so neither can drift silently.
    assert.equal(evaluate(`DISPLAY(${rows}, "bar") = DISPLAY(${rows}, "line")`).kind, "logic");
    assert.deepEqual(toWire(evaluate(`DISPLAY(${rows}, "bar") = DISPLAY(${rows}, "line")`)), {
      kind: "logic",
      value: true
    });
  });

  await t.test("intent survives shape-preserving operations and is dropped by reshaping ones", () => {
    const displayOf = (source: string): string | undefined => {
      const wire = wireOf(source);
      return wire.kind === "table" ? wire.display : undefined;
    };
    const bar = `DISPLAY(TABLE({r: "w", v: 1}, {r: "e", v: 2}), "bar")`;

    // Filtering, ordering, and truncating a bar chart leave it a bar chart.
    assert.equal(displayOf(`WHERE(${bar}, {all: [{field: "v", op: "greaterThan", value: 0}]})`), "bar");
    assert.equal(displayOf(`SORT(${bar}, [{field: "v"}])`), "bar");
    assert.equal(displayOf(`LIMIT(${bar}, 1)`), "bar");
    assert.equal(displayOf(`ASTABLE(${bar}, "X")`), "bar");

    // Reshaping replaces the columns, so the old intent no longer describes it.
    assert.equal(displayOf(`GROUP(${bar}, {keys: ["r"]})`), undefined);
    assert.equal(displayOf(`AGGREGATE(${bar}, {aggregates: [{as: "S", field: "v", fn: "sum"}]})`), undefined);
    assert.equal(
      displayOf(`JOIN(${bar}, TABLE({r: "w"}), {on: [{left: "r", right: "r"}], leftAs: "L", rightAs: "R"})`),
      undefined
    );
  });

  await t.test("an out-of-vocabulary annotation from the wire is dropped, not trusted", () => {
    const smuggled = {
      kind: "table" as const,
      fields: ["r"],
      rows: [[{ kind: "text" as const, value: "w" }]],
      display: "sankey" as never
    };
    const restored = fromWire(smuggled);
    assert.equal(restored.kind === "table" ? restored.display : "unset", undefined);
  });
});

// ─── Quoted names ─────────────────────────────────────────────────────────────

test("backtick-quoted names reference entries that are not identifier-safe", async (t) => {
  const snapshot = emptySnapshot(new Map([
    [normalizeKey("Q3 Orders"), binding("Q3 Orders", makeTable(["region"], [[makeText("west")]]))],
    [normalizeKey("plain"), binding("plain", makeNumber(fromInt(7n)))]
  ]));

  await t.test("a name with a space resolves and is usable", () => {
    assert.deepEqual(rowsOf("`Q3 Orders`", snapshot), [["west"]]);
  });

  await t.test("it works wherever a bare name works", () => {
    assert.deepEqual(rowsOf('ASTABLE(`Q3 Orders`, "Q3 Orders")', snapshot), [["west"]]);
    assert.deepEqual(
      rowsOf('WHERE(`Q3 Orders`, {all: [{field: "region", op: "equals", value: "west"}]})', snapshot),
      [["west"]]
    );
  });

  await t.test("field access reads through a quoted name", () => {
    const one = emptySnapshot(new Map([
      [normalizeKey("Q3 Orders"), binding("Q3 Orders", makeRecord(["region"], [makeText("west")]))]
    ]));
    assert.deepEqual(toWire(evaluate("`Q3 Orders`.region", one)), { kind: "text", value: "west" });
  });

  await t.test("every escape the string lexer supports also works here", () => {
    const odd = emptySnapshot(new Map([
      [normalizeKey("a\tb"), binding("a\tb", makeNumber(fromInt(1n)))],
      [normalizeKey("a\\b"), binding("a\\b", makeNumber(fromInt(2n)))]
    ]));
    assert.deepEqual(toWire(evaluate("`a\\tb`", odd)), { kind: "number", numerator: "1", denominator: "1" });
    assert.deepEqual(toWire(evaluate("`a\\\\b`", odd)), { kind: "number", numerator: "2", denominator: "1" });
  });

  await t.test("a trailing backslash is a parse error, not a read past the end", () => {
    assert.deepEqual(codesOf("`abc\\"), ["parse_error"]);
  });

  await t.test("a quoted name is matched case-insensitively, like a bare one", () => {
    assert.deepEqual(rowsOf("`q3 ORDERS`", snapshot), [["west"]]);
  });

  await t.test("quoting an already-legal name changes nothing", () => {
    assert.deepEqual(toWire(evaluate("`plain`", snapshot)), toWire(evaluate("plain", snapshot)));
  });

  await t.test("escapes let a name contain a backtick", () => {
    const odd = emptySnapshot(new Map([
      [normalizeKey("a`b"), binding("a`b", makeNumber(fromInt(3n)))]
    ]));
    assert.deepEqual(toWire(evaluate("`a\\`b`", odd)), { kind: "number", numerator: "3", denominator: "1" });
  });

  await t.test("an unterminated or empty quoted name is a parse error", () => {
    assert.deepEqual(codesOf("`Q3 Orders"), ["parse_error"]);
    assert.deepEqual(codesOf("``"), ["parse_error"]);
  });

  await t.test("an unknown quoted name is an unknown identifier, not a crash", () => {
    assert.deepEqual(codesOf("`No Such Table`", snapshot), ["unknown_identifier"]);
  });
});

// ─── Seams this change created in other capabilities ──────────────────────────
//
// These two live here rather than with their own capabilities because both exist
// only because of the Formula change above, and both fail silently without a
// test: neither is reachable by the type checker.

test("adding builtins does not silently unbind existing project names", async (t) => {
  await t.test("Structured Data refuses a name that is now a builtin", () => {
    for (const reserved of ["join", "where", "group", "aggregate", "sort", "limit", "display", "astable"]) {
      assert.throws(
        () => validateDisplayName(reserved, 256),
        /reserved by Formula/,
        `${reserved} should be reserved`
      );
      // Case-insensitively, matching how names are normalized everywhere else.
      assert.throws(() => validateDisplayName(reserved.toUpperCase(), 256), /reserved by Formula/);
    }
  });

  await t.test("ordinary names are still accepted", () => {
    for (const ok of ["Orders", "Reps", "grouping", "sorted", "limits", "displayName"]) {
      assert.equal(validateDisplayName(ok, 256), ok);
    }
  });

  await t.test("the reserved set is the engine's own, not a copy that can drift", () => {
    // The binder short-circuits on isBuiltinName before consulting the snapshot,
    // so ingress must ask the same predicate or an entry can be created that
    // never resolves.
    assert.equal(isBuiltinName("JOIN"), true);
    assert.equal(isBuiltinName("sum"), true);
    assert.equal(isBuiltinName("Orders"), false);
  });
});

test("the Document wire decoder accepts a displayed table and bounds its kind", async (t) => {
  const operation = (value: unknown) => ({
    type: "apply-formula-result",
    atomId: "atom-1",
    value,
    displayText: "chart"
  });
  const table = (extra: Record<string, unknown> = {}) => ({
    kind: "table",
    fields: ["r"],
    rows: [[{ kind: "text", value: "west" }]],
    ...extra
  });

  await t.test("a table with no display still decodes", () => {
    assert.doesNotThrow(() => decodeRichTextOperation(operation(table()), "op"));
  });

  await t.test("a display-annotated table decodes instead of being rejected as an extra key", () => {
    assert.doesNotThrow(() => decodeRichTextOperation(operation(table({ display: "bar" })), "op"));
  });

  await t.test("an unknown display kind is refused at the seam", () => {
    assert.throws(
      () => decodeRichTextOperation(operation(table({ display: "sankey" })), "op"),
      /display must be one of/
    );
  });

  await t.test("a list may not carry a display annotation", () => {
    const list = { kind: "list", fields: ["value"], rows: [[{ kind: "text", value: "x" }]], display: "bar" };
    assert.throws(() => decodeRichTextOperation(operation(list), "op"));
  });
});

// ─── The compiled pipeline end to end ─────────────────────────────────────────

test("the relational builtins compose into a full analytic pipeline", () => {
  // This is the shape domain/compile.ts will emit: the worked example from
  // scratch/structured-analytic-design/compilation.md.
  const snapshot = emptySnapshot(new Map([
    [normalizeKey("Orders"), binding("Orders", fromWire(toWire(evaluate(ORDERS))))],
    [normalizeKey("Reps"), binding("Reps", fromWire(toWire(evaluate(REPS))))]
  ]));

  const source = `DISPLAY(
    LIMIT(
      SORT(
        GROUP(
          WHERE(
            JOIN(
              ASTABLE(Orders, "Orders"),
              ASTABLE(Reps, "Reps"),
              {kind: "left", on: [{left: "repId", right: "id"}], leftAs: "Orders", rightAs: "Reps"}
            ),
            {all: [{field: "Orders.status", op: "equals", value: "closed"}]}
          ),
          {keys: ["Orders.region"], aggregates: [{as: "Total", field: "Orders.amount", fn: "sum"}]}
        ),
        [{field: "Total", direction: "desc"}]
      ),
      10
    ),
    "bar"
  )`;

  assert.deepEqual(fieldsOf(source, snapshot), ["Orders.region", "Total"]);
  assert.deepEqual(rowsOf(source, snapshot), [["west", 40]]);

  const wire = wireOf(source, snapshot);
  assert.equal(wire.kind === "table" ? wire.display : undefined, "bar");
});
