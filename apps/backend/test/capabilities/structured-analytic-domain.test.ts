import assert from "node:assert/strict";
import test from "node:test";
import {
  AnalyticConfigurationError,
  AnalyticValidationError
} from "../../src/3-capabilities/structured-analytic/domain/errors.js";
import {
  ANALYTIC_AGGREGATIONS,
  ANALYTIC_DISPLAY_KINDS,
  ANALYTIC_FILTER_OPERATORS,
  ANALYTIC_JOIN_KINDS,
  ANALYTIC_SORT_DIRECTIONS,
  DEFAULT_STRUCTURED_ANALYTIC_LIMITS,
  STRUCTURED_ANALYTIC_LIMIT_KEYS,
  inputKey,
  placementName
} from "../../src/3-capabilities/structured-analytic/domain/model.js";
import {
  AGGREGATE_FNS,
  DISPLAY_KINDS,
  SORT_DIRECTIONS,
  WHERE_OPS,
  isDisplayKind
} from "../../src/0-platform/formula/index.js";
import type {
  AnalyticFieldPlacement,
  StructuredAnalyticLimits
} from "../../src/3-capabilities/structured-analytic/domain/model.js";
import {
  describeDefinition,
  normalizeInputKey,
  validateAnalyticDefinition,
  validateAnalyticDescription,
  validateAnalyticLimits,
  validateAnalyticTitle
} from "../../src/3-capabilities/structured-analytic/domain/validation.js";
import { loadBackendConfig } from "../../src/0-utils/config/loadBackendConfig.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const OPTIONS = DEFAULT_STRUCTURED_ANALYTIC_LIMITS;

/** The reference definition every case perturbs: a bar chart over one join. */
const base = (): Record<string, unknown> => ({
  inputs: [{ name: "Orders" }, { name: "Reps" }],
  joins: [
    {
      kind: "left",
      left: "Orders",
      right: "Reps",
      on: [{ leftField: "repId", rightField: "id" }]
    }
  ],
  columns: [
    { id: "p1", field: { input: "Orders", field: "region" }, aggregation: "none" }
  ],
  rows: [
    { id: "p2", field: { input: "Orders", field: "amount" }, aggregation: "sum", label: "Total" }
  ],
  filters: [
    {
      field: { input: "Orders", field: "status" },
      operator: "equals",
      value: { kind: "text", value: "closed" }
    }
  ],
  sorts: [{ placementId: "p2", direction: "desc" }],
  limit: 10,
  display: { kind: "bar" }
});

/** A single-input table, the simplest thing that validates. */
const simple = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
  inputs: [{ name: "Orders" }],
  joins: [],
  columns: [{ id: "c1", field: { input: "Orders", field: "region" }, aggregation: "none" }],
  rows: [],
  filters: [],
  sorts: [],
  display: { kind: "table" },
  ...patch
});

const accepts = (definition: unknown, options: StructuredAnalyticLimits = OPTIONS) =>
  validateAnalyticDefinition(definition, options);

/**
 * `expectedField` is the assertion that matters: `error.field` is the only
 * machine-readable part of a rejection and the thing job wiring will put in a
 * 400 body, whereas the message is prose that any rewording breaks. It is
 * optional so existing call sites stay valid, but new ones should pass it.
 */
const rejects = (
  definition: unknown,
  message: RegExp,
  expectedField?: string,
  options: StructuredAnalyticLimits = OPTIONS
): void => {
  assert.throws(
    () => validateAnalyticDefinition(definition, options),
    (error: unknown) => {
      assert.ok(
        error instanceof AnalyticValidationError,
        `expected an AnalyticValidationError, got ${String(error)}`
      );
      assert.match(error.message, message);
      if (expectedField !== undefined) assert.equal(error.field, expectedField);
      // The message is exactly `${field}: ${reason}`, and `reason` is kept as
      // its own field so a caller need not strip the prefix back off.
      assert.equal(error.message, `${error.field}: ${error.reason}`);
      return true;
    }
  );
};

/** `rejects` with the limits overridden — the old positional third argument. */
const rejectsWith = (
  definition: unknown,
  message: RegExp,
  options: StructuredAnalyticLimits
): void => rejects(definition, message, undefined, options);

// ─── Model helpers ────────────────────────────────────────────────────────────

test("an input's key is its alias when given and its name otherwise", () => {
  assert.equal(inputKey({ name: "Orders" }), "Orders");
  assert.equal(inputKey({ name: "Orders", as: "O2" }), "O2");
  assert.equal(normalizeInputKey("  Q3 Orders  "), "q3 orders");
});

test("a placement's output name is its label, falling back to the source field", () => {
  const labelled: AnalyticFieldPlacement = {
    id: "p", field: { input: "Orders", field: "amount" }, aggregation: "sum", label: "Total"
  };
  const bare: AnalyticFieldPlacement = {
    id: "p", field: { input: "Orders", field: "amount" }, aggregation: "sum"
  };
  assert.equal(placementName(labelled), "Total");
  assert.equal(placementName(bare), "amount");
});

// ─── Inputs ───────────────────────────────────────────────────────────────────

test("inputs must be a nonempty, uniquely keyed, bounded list", async (t) => {
  await t.test("the reference definition is accepted", () => {
    const definition = accepts(base());
    assert.equal(definition.inputs.length, 2);
    assert.equal(definition.display.kind, "bar");
  });

  await t.test("an empty or non-array inputs list is refused", () => {
    rejects({ ...base(), inputs: [] }, /inputs: must not be empty/);
    rejects({ ...base(), inputs: {} }, /inputs: must be an array/);
  });

  await t.test("a blank or non-string name is refused", () => {
    rejects(simple({ inputs: [{ name: "   " }] }), /inputs\[0\]\.name: must not be blank/);
    rejects(simple({ inputs: [{ name: 5 }] }), /inputs\[0\]\.name: must be a string/);
  });

  await t.test("duplicate keys are refused, case-insensitively", () => {
    rejects(
      { ...base(), inputs: [{ name: "Orders" }, { name: "orders" }] },
      /duplicate input key/
    );
  });

  await t.test("a self-join is expressible through `as`", () => {
    const definition = accepts({
      inputs: [{ name: "Orders" }, { name: "Orders", as: "Prior" }],
      joins: [{ kind: "inner", left: "Orders", right: "Prior", on: [{ leftField: "id", rightField: "id" }] }],
      columns: [{ id: "c", field: { input: "Prior", field: "region" }, aggregation: "none" }],
      rows: [],
      filters: [],
      sorts: [],
      display: { kind: "table" }
    });
    assert.deepEqual(definition.inputs.map(inputKey), ["Orders", "Prior"]);
  });

  await t.test("maxInputs is enforced", () => {
    const many = Array.from({ length: 3 }, (_, index) => ({ name: `T${index}` }));
    const joins = [1, 2].map(index => ({
      kind: "inner", left: "T0", right: `T${index}`, on: [{ leftField: "a", rightField: "a" }]
    }));
    const definition = { ...simple(), inputs: many, joins,
      columns: [{ id: "c", field: { input: "T0", field: "a" }, aggregation: "none" }] };
    accepts(definition, { ...OPTIONS, maxInputs: 3 });
    rejectsWith(definition, /inputs: exceeds maxInputs \(2\)/, { ...OPTIONS, maxInputs: 2 });
  });

  await t.test("an optional entryId round-trips when present and is absent otherwise", () => {
    assert.equal(accepts(simple()).inputs[0].entryId, undefined);
    const withId = accepts(simple({ inputs: [{ name: "Orders", entryId: "entry-1" }] }));
    assert.equal(withId.inputs[0].entryId, "entry-1");
  });
});

// ─── Joins ────────────────────────────────────────────────────────────────────

test("joins are an ordered left-deep chain, which is what makes cycles unrepresentable", async (t) => {
  await t.test("one input needs no joins", () => {
    assert.equal(accepts(simple()).joins.length, 0);
  });

  await t.test("the join count must introduce every input after the first", () => {
    rejects({ ...base(), joins: [] }, /joins: must introduce every input after the first/);
    rejects(
      { ...base(), joins: [...(base().joins as unknown[]), (base().joins as unknown[])[0]] },
      /joins: must introduce every input after the first/
    );
  });

  await t.test("joins[i] must introduce inputs[i+1], in order", () => {
    const three = {
      inputs: [{ name: "A" }, { name: "B" }, { name: "C" }],
      joins: [
        { kind: "inner", left: "A", right: "C", on: [{ leftField: "k", rightField: "k" }] },
        { kind: "inner", left: "A", right: "B", on: [{ leftField: "k", rightField: "k" }] }
      ],
      columns: [{ id: "c", field: { input: "A", field: "k" }, aggregation: "none" }],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    };
    rejects(three, /joins\[0\]\.right: must introduce B, got C/);
  });

  await t.test("the left side must already be introduced", () => {
    const forward = {
      inputs: [{ name: "A" }, { name: "B" }, { name: "C" }],
      joins: [
        { kind: "inner", left: "C", right: "B", on: [{ leftField: "k", rightField: "k" }] },
        { kind: "inner", left: "A", right: "C", on: [{ leftField: "k", rightField: "k" }] }
      ],
      columns: [{ id: "c", field: { input: "A", field: "k" }, aggregation: "none" }],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    };
    rejects(forward, /joins\[0\]\.left: is not introduced yet: C/);
  });

  await t.test("a chained join is accepted", () => {
    const definition = accepts({
      inputs: [{ name: "A" }, { name: "B" }, { name: "C" }],
      joins: [
        { kind: "inner", left: "A", right: "B", on: [{ leftField: "k", rightField: "k" }] },
        { kind: "left", left: "B", right: "C", on: [{ leftField: "k", rightField: "k" }] }
      ],
      columns: [{ id: "c", field: { input: "C", field: "k" }, aggregation: "none" }],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    });
    assert.deepEqual(definition.joins.map(join => join.right), ["B", "C"]);
  });

  await t.test("the on list must be nonempty and bounded", () => {
    const withOn = (on: unknown) => ({
      ...base(),
      joins: [{ kind: "left", left: "Orders", right: "Reps", on }]
    });
    rejects(withOn([]), /joins\[0\]\.on: must not be empty/, "joins[0].on");
    rejects(withOn({}), /joins\[0\]\.on: must be an array/, "joins[0].on");
    rejectsWith(
      withOn([{ leftField: "a", rightField: "b" }, { leftField: "c", rightField: "d" }]),
      /joins\[0\]\.on: exceeds maxJoinKeys \(1\)/,
      { ...OPTIONS, maxJoinKeys: 1 }
    );
  });

  await t.test("an unsupported join kind is refused", () => {
    rejects(
      { ...base(), joins: [{ kind: "full", left: "Orders", right: "Reps", on: [{ leftField: "a", rightField: "b" }] }] },
      /joins\[0\]\.kind: must be one of: inner, left/
    );
  });
});

// ─── Field references and placements ──────────────────────────────────────────

test("every field reference names a declared input", async (t) => {
  await t.test("a reference to an undeclared input is refused", () => {
    rejects(
      simple({ columns: [{ id: "c", field: { input: "Nope", field: "region" }, aggregation: "none" }] }),
      /names no declared input: Nope/
    );
  });

  await t.test("input keys match case-insensitively, like every other name", () => {
    assert.doesNotThrow(() =>
      accepts(simple({ columns: [{ id: "c", field: { input: "orders", field: "region" }, aggregation: "none" }] })));
  });

  // Compilation qualifies every joined column as `<inputKey>.<field>`, so the
  // stored spelling has to be the declared one. Accepting `orders` and storing
  // it verbatim would compile against a table whose columns are `Orders.…` and
  // fail on every pull, for a definition that validated cleanly.
  await t.test("a case-variant reference is stored as the input declared it", () => {
    const definition = accepts(simple({
      columns: [{ id: "c", field: { input: "oRdErS", field: "region" }, aggregation: "none" }]
    }));
    assert.equal(definition.columns[0].field.input, "Orders");
  });

  await t.test("a case-variant reference to a self-join label is canonicalized too", () => {
    const definition = accepts({
      inputs: [{ name: "Orders" }, { name: "Orders", as: "Prior" }],
      joins: [{ kind: "inner", left: "orders", right: "PRIOR", on: [{ leftField: "id", rightField: "id" }] }],
      columns: [{ id: "c", field: { input: "prior", field: "region" }, aggregation: "none" }],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    });
    assert.equal(definition.columns[0].field.input, "Prior");
    assert.equal(definition.joins[0].left, "Orders");
    assert.equal(definition.joins[0].right, "Prior");
  });

  await t.test("a case-variant filter reference is canonicalized too", () => {
    const definition = accepts(simple({
      filters: [{
        field: { input: "ORDERS", field: "status" },
        operator: "equals",
        value: { kind: "text", value: "closed" }
      }]
    }));
    assert.equal(definition.filters[0].field.input, "Orders");
  });

  await t.test("a self-join alias is a legal reference target", () => {
    assert.doesNotThrow(() => accepts({
      inputs: [{ name: "Orders" }, { name: "Orders", as: "Prior" }],
      joins: [{ kind: "inner", left: "Orders", right: "Prior", on: [{ leftField: "id", rightField: "id" }] }],
      columns: [{ id: "c", field: { input: "Prior", field: "region" }, aggregation: "none" }],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    }));
  });
});

test("placements have unique ids, valid aggregations, and an optional label", async (t) => {
  await t.test("an id repeated across Rows and Columns is refused", () => {
    rejects(
      {
        ...base(),
        columns: [{ id: "same", field: { input: "Orders", field: "region" }, aggregation: "none" }],
        rows: [{ id: "same", field: { input: "Orders", field: "amount" }, aggregation: "sum" }]
      },
      /duplicates another placement id: same/,
      // Rows are walked first, so the Columns entry is the one reported.
      "columns[0].id"
    );
  });

  // `field` is the only machine-readable part of a rejection, and an editing
  // surface highlights it. Reporting "rows" for a duplicate in Columns sends
  // the client to the wrong pill.
  await t.test("a duplicate within one shelf names that shelf and index", () => {
    rejects(
      simple({
        columns: [
          { id: "dup", field: { input: "Orders", field: "a" }, aggregation: "none" },
          { id: "dup", field: { input: "Orders", field: "b" }, aggregation: "none" }
        ]
      }),
      /duplicates another placement id/,
      "columns[1].id"
    );
    rejects(
      simple({
        columns: [{ id: "keep", field: { input: "Orders", field: "a" }, aggregation: "none" }],
        rows: [
          { id: "r", field: { input: "Orders", field: "a" }, aggregation: "sum" },
          { id: "r", field: { input: "Orders", field: "b" }, aggregation: "sum" }
        ]
      }),
      /duplicates another placement id/,
      "rows[1].id"
    );
  });

  await t.test("placement ids are matched exactly, unlike input keys", () => {
    // Deliberate asymmetry: an input key is a project name and matches the way
    // Structured Data matches names; a placement id is an opaque handle the
    // client mints, so `a` and `A` are two different pills.
    const definition = accepts(simple({
      columns: [
        { id: "p", field: { input: "Orders", field: "a" }, aggregation: "none" },
        { id: "P", field: { input: "Orders", field: "b" }, aggregation: "none" }
      ]
    }));
    assert.deepEqual(definition.columns.map(placement => placement.id), ["p", "P"]);

    rejects(
      simple({
        columns: [{ id: "p2", field: { input: "Orders", field: "a" }, aggregation: "none" }],
        sorts: [{ placementId: "P2", direction: "asc" }]
      }),
      /names no declared placement/,
      "sorts[0].placementId"
    );
  });

  await t.test("an unsupported aggregation is refused", () => {
    rejects(
      simple({ columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "median" }] }),
      /columns\[0\]\.aggregation: must be one of/
    );
  });

  await t.test("every declared aggregation is accepted", () => {
    for (const aggregation of ["none", "sum", "count", "average", "min", "max"]) {
      const rows = aggregation === "none" ? [] : [{ id: "r", field: { input: "Orders", field: "amount" }, aggregation }];
      assert.doesNotThrow(() => accepts(simple({ rows })), `${aggregation} should be accepted`);
    }
  });

  await t.test("maxPlacements counts Rows and Columns together", () => {
    const definition = simple({
      columns: [
        { id: "a", field: { input: "Orders", field: "x" }, aggregation: "none" },
        { id: "b", field: { input: "Orders", field: "y" }, aggregation: "none" }
      ]
    });
    accepts(definition, { ...OPTIONS, maxPlacements: 2 });
    rejectsWith(definition, /exceed maxPlacements \(1\)/, { ...OPTIONS, maxPlacements: 1 });
  });

  await t.test("a label is optional and bounded", () => {
    assert.equal(accepts(base()).rows[0].label, "Total");
    assert.equal(accepts(simple()).columns[0].label, undefined);
    rejects(
      simple({ columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation: "none", label: "" }] }),
      /columns\[0\]\.label: must not be blank/
    );
  });
});

// ─── Filters ──────────────────────────────────────────────────────────────────

test("filter shapes are validated per operator", async (t) => {
  const withFilter = (filter: unknown) => simple({ filters: [filter] });
  const ref = { input: "Orders", field: "status" };

  await t.test("every comparison operator takes one scalar value", () => {
    for (const operator of [
      "equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"
    ]) {
      assert.doesNotThrow(() =>
        accepts(withFilter({ field: ref, operator, value: { kind: "number", numerator: "1", denominator: "1" } })));
    }
    rejects(withFilter({ field: ref, operator: "matches", value: { kind: "null" } }), /operator: must be one of/);
  });

  await t.test("in requires a nonempty values array", () => {
    assert.doesNotThrow(() =>
      accepts(withFilter({ field: ref, operator: "in", values: [{ kind: "text", value: "a" }] })));
    rejects(withFilter({ field: ref, operator: "in", values: [] }), /values: must not be empty/);
    rejects(withFilter({ field: ref, operator: "in", values: "a" }), /values: must be an array/);
  });

  await t.test("contains requires text plus an explicit caseSensitive flag", () => {
    assert.doesNotThrow(() =>
      accepts(withFilter({ field: ref, operator: "contains", value: "clo", caseSensitive: false })));
    rejects(
      withFilter({ field: ref, operator: "contains", value: "clo" }),
      /caseSensitive: must be a boolean/
    );
    rejects(
      withFilter({ field: ref, operator: "contains", value: 5, caseSensitive: true }),
      /value: must be a string/
    );
  });

  await t.test("isNull and isNotNull take no value", () => {
    for (const operator of ["isNull", "isNotNull"]) {
      const definition = accepts(withFilter({ field: ref, operator }));
      assert.equal(definition.filters[0].operator, operator);
    }
  });

  await t.test("a number literal is an exact numerator/denominator pair", () => {
    assert.doesNotThrow(() =>
      accepts(withFilter({ field: ref, operator: "equals", value: { kind: "number", numerator: "-1", denominator: "3" } })));
    rejects(
      withFilter({ field: ref, operator: "equals", value: { kind: "number", numerator: 1, denominator: "3" } }),
      /numerator: must be a string/
    );
    rejects(
      withFilter({ field: ref, operator: "equals", value: { kind: "number", numerator: "1", denominator: "0" } }),
      /denominator: must be a positive integer string/
    );
    rejects(
      withFilter({ field: ref, operator: "equals", value: { kind: "number", numerator: "1.5", denominator: "1" } }),
      /numerator: must be an integer string/
    );
  });

  await t.test("an unknown scalar kind is refused", () => {
    rejects(withFilter({ field: ref, operator: "equals", value: { kind: "date", value: "x" } }), /kind: must be null, number, text, or logic/);
  });

  await t.test("maxFilters is enforced", () => {
    const one = { field: ref, operator: "isNull" };
    accepts(simple({ filters: [one] }), { ...OPTIONS, maxFilters: 1 });
    rejectsWith(simple({ filters: [one, one] }), /filters: exceeds maxFilters \(1\)/, { ...OPTIONS, maxFilters: 1 });
  });
});

// ─── Sorts, limit ─────────────────────────────────────────────────────────────

test("sorts target declared placements and limit is a positive integer", async (t) => {
  await t.test("a sort naming no placement is refused", () => {
    rejects({ ...base(), sorts: [{ placementId: "nope", direction: "asc" }] }, /names no declared placement: nope/);
  });

  await t.test("both directions are accepted and anything else is not", () => {
    for (const direction of ["asc", "desc"]) {
      assert.doesNotThrow(() => accepts({ ...base(), sorts: [{ placementId: "p2", direction }] }));
    }
    rejects({ ...base(), sorts: [{ placementId: "p2", direction: "up" }] }, /direction: must be one of: asc, desc/);
  });

  await t.test("maxSorts is enforced", () => {
    const sort = { placementId: "p2", direction: "asc" };
    accepts({ ...base(), sorts: [sort] }, { ...OPTIONS, maxSorts: 1 });
    rejectsWith({ ...base(), sorts: [sort, sort] }, /sorts: exceeds maxSorts \(1\)/, { ...OPTIONS, maxSorts: 1 });
  });

  await t.test("limit is optional but must be a positive integer when present", () => {
    assert.equal(accepts(simple()).limit, undefined);
    assert.equal(accepts({ ...base(), limit: 5 }).limit, 5);
    rejects({ ...base(), limit: 0 }, /limit: must be a positive integer/);
    rejects({ ...base(), limit: -1 }, /limit: must be a positive integer/);
    rejects({ ...base(), limit: 1.5 }, /limit: must be a positive integer/);
  });
});

// ─── The structural display contract ──────────────────────────────────────────

test("the display's structural contract is checked at save, because data cannot fix it", async (t) => {
  const shelves = (columns: unknown[], rows: unknown[], kind: string) =>
    simple({ columns, rows, display: { kind } });
  const dimension = (id: string) => ({ id, field: { input: "Orders", field: "region" }, aggregation: "none" });
  const measure = (id: string) => ({ id, field: { input: "Orders", field: "amount" }, aggregation: "sum" });

  await t.test("a table needs at least one placement anywhere", () => {
    assert.doesNotThrow(() => accepts(shelves([dimension("c")], [], "table")));
    assert.doesNotThrow(() => accepts(shelves([], [measure("r")], "table")));
    rejects(shelves([], [], "table"), /a table requires at least one Rows or Columns placement/);
  });

  await t.test("bar, line, area, and pie need one dimension and one measure", () => {
    for (const kind of ["bar", "line", "area", "pie"]) {
      assert.doesNotThrow(() => accepts(shelves([dimension("c")], [measure("r")], kind)), kind);
      rejects(shelves([dimension("c")], [], kind), new RegExp(`a ${kind} requires exactly one aggregated Rows`));
      rejects(shelves([], [measure("r")], kind), new RegExp(`a ${kind} requires exactly one non-aggregated Columns`));
      // Two measures and no dimension can never render, for any data.
      rejects(shelves([measure("c")], [measure("r")], kind), new RegExp(`a ${kind} requires exactly one non-aggregated Columns`));
      rejects(
        shelves([dimension("c")], [measure("r1"), measure("r2")], kind),
        new RegExp(`a ${kind} requires exactly one aggregated Rows`)
      );
    }
  });

  await t.test("scatter needs a non-aggregated value on each shelf", () => {
    assert.doesNotThrow(() => accepts(shelves([dimension("c")], [dimension("r")], "scatter")));
    rejects(shelves([dimension("c")], [measure("r")], "scatter"), /a scatter requires exactly one non-aggregated Rows/);
    rejects(shelves([measure("c")], [dimension("r")], "scatter"), /a scatter requires exactly one non-aggregated Columns/);
  });

  await t.test("an unsupported display kind is refused", () => {
    rejects(simple({ display: { kind: "sankey" } }), /display\.kind: must be one of/);
    rejects(simple({ display: "bar" }), /display: must be an object/);
  });
});

// ─── Title, description, options ──────────────────────────────────────────────

test("title, description, and the options themselves are validated", async (t) => {
  await t.test("a title is required, trimmed, and bounded", () => {
    assert.equal(validateAnalyticTitle("  Revenue  ", OPTIONS), "Revenue");
    assert.throws(() => validateAnalyticTitle("", OPTIONS), AnalyticValidationError);
    assert.throws(() => validateAnalyticTitle(5, OPTIONS), AnalyticValidationError);
    assert.throws(
      () => validateAnalyticTitle("x".repeat(20), { ...OPTIONS, maxTitleBytes: 10 }),
      AnalyticValidationError
    );
  });

  await t.test("a description is optional", () => {
    assert.equal(validateAnalyticDescription(undefined, OPTIONS), undefined);
    assert.equal(validateAnalyticDescription(" by region ", OPTIONS), "by region");
    assert.throws(() => validateAnalyticDescription("", OPTIONS), AnalyticValidationError);
  });

  // A bad limit is an operator's mistake in configuration.yaml, not a caller's.
  // Throwing AnalyticValidationError would map to 400 and blame the client for
  // it, while echoing an internal field name back to them.
  await t.test("a bad limit is a configuration error, not a validation error", () => {
    assert.doesNotThrow(() => validateAnalyticLimits(OPTIONS));
    assert.throws(
      () => validateAnalyticLimits({ ...OPTIONS, maxInputs: 0 }),
      (error: unknown) => error instanceof AnalyticConfigurationError && error.limit === "maxInputs"
    );
    assert.throws(
      () => validateAnalyticLimits({ ...OPTIONS, maxSorts: 1.5 }),
      (error: unknown) => error instanceof AnalyticConfigurationError && error.limit === "maxSorts"
    );
    assert.equal(
      new AnalyticConfigurationError("maxInputs", "boom") instanceof AnalyticValidationError,
      false
    );
  });

  // A limit built by omission is silently permissive: `bytes > undefined` and
  // `length > undefined` are both false, so the missing key disables exactly
  // the check it names. Iterating Object.entries could never catch that.
  await t.test("a missing limit is rejected rather than silently disabling a check", () => {
    for (const key of STRUCTURED_ANALYTIC_LIMIT_KEYS) {
      const incomplete = { ...OPTIONS } as Record<string, unknown>;
      delete incomplete[key];
      assert.throws(
        () => validateAnalyticLimits(incomplete as unknown as StructuredAnalyticLimits),
        (error: unknown) => error instanceof AnalyticConfigurationError && error.limit === key,
        `a missing ${key} must be rejected`
      );
    }
  });

  await t.test("the rejection is logged before it is thrown", () => {
    const logger = new CapturingLogger();
    assert.throws(() => validateAnalyticLimits({ ...OPTIONS, maxFilters: -1 }, logger));

    const entry = logger.entries.find(e => e.message === "structured-analytic.limits.rejected");
    assert.ok(entry, "a startup-fatal misconfiguration must be logged");
    assert.equal(entry.level, "error");
    assert.deepEqual(entry.data, { limit: "maxFilters", value: -1 });
  });
});

// ─── Observability ────────────────────────────────────────────────────────────

/** Every distinctive string in `base()`, so a leak can be located by name. */
const BASE_CONTENT = ["Orders", "Reps", "region", "amount", "repId", "closed", "Total"];

test("validation logs content, and labels it so production can drop it", async (t) => {
  await t.test("an accepted definition logs counts, enums, and a duration", () => {
    const logger = new CapturingLogger();
    validateAnalyticDefinition(base(), OPTIONS, logger);

    const entry = logger.entries.find(e => e.message === "structured-analytic.definition.validated");
    assert.ok(entry, "expected a validated event");
    assert.equal(entry.level, "debug");
    const data = entry.data as Record<string, unknown>;
    assert.equal(data.inputCount, 2);
    assert.equal(data.joinCount, 1);
    assert.equal(data.rowPlacementCount, 1);
    assert.equal(data.columnPlacementCount, 1);
    assert.equal(data.aggregatedPlacementCount, 1);
    assert.equal(data.filterCount, 1);
    assert.equal(data.sortCount, 1);
    assert.equal(data.hasLimit, true);
    assert.equal(data.displayKind, "bar");
    assert.equal(data.selfJoinCount, 0);
    assert.equal(typeof data.durationMs, "number");
  });

  await t.test("an accepted definition also logs the definition itself", () => {
    const logger = new CapturingLogger();
    const definition = validateAnalyticDefinition(base(), OPTIONS, logger);

    const entry = logger.entries.find(
      e => e.message === "structured-analytic.definition.validated.detail"
    );
    assert.ok(entry);
    assert.equal(entry.detail, "content", "a record carrying the definition must say so");
    assert.deepEqual((entry.data as Record<string, unknown>).definition, definition);
  });

  // A content-labelled record is dropped WHOLE, not field by field. Folding the
  // counts into it would mean a successful validation logged nothing at all in
  // a shape-only build — which is what this file's comments claimed it avoided.
  await t.test("dropping content still leaves the acceptance visible", () => {
    const logger = new CapturingLogger();
    validateAnalyticDefinition(base(), OPTIONS, logger);

    const kept = logger.shapeEntries.filter(e => e.message.startsWith("structured-analytic"));
    assert.equal(kept.length, 1);
    const data = kept[0].data as Record<string, unknown>;
    assert.equal(data.inputCount, 2);
    assert.equal(data.displayKind, "bar");
    assert.equal(typeof data.durationMs, "number");
    assert.equal(data.definition, undefined, "the definition belongs to the content record");
  });

  await t.test("a rejected definition logs the rule that fired, at warn", () => {
    const logger = new CapturingLogger();
    assert.throws(() => validateAnalyticDefinition({ ...base(), inputs: [] }, OPTIONS, logger));

    const entry = logger.entries.find(e => e.message === "structured-analytic.definition.rejected");
    assert.ok(entry, "expected a rejected event");
    assert.equal(entry.level, "warn");
    assert.equal(entry.detail, undefined, "the fact of a rejection must survive shape-only");
    const data = entry.data as Record<string, unknown>;
    assert.equal(data.field, "inputs");
    assert.equal(data.errorName, "AnalyticValidationError");
  });

  await t.test("a rejected definition logs the payload that broke it, separately", () => {
    const logger = new CapturingLogger();
    const bad = { ...base(), limit: 0 };
    assert.throws(() => validateAnalyticDefinition(bad, OPTIONS, logger));

    const entry = logger.entries.find(
      e => e.message === "structured-analytic.definition.rejected.detail"
    );
    assert.ok(entry, "expected a rejected detail event");
    assert.equal(entry.detail, "content");
    const data = entry.data as Record<string, unknown>;
    assert.equal(data.field, "limit");
    assert.deepEqual(data.rejected, bad, "the offending payload is logged verbatim");
    assert.match(String(data.reason), /positive integer/);
  });

  await t.test("dropping content still leaves the rejection visible", () => {
    const logger = new CapturingLogger();
    assert.throws(() => validateAnalyticDefinition({ ...base(), limit: 0 }, OPTIONS, logger));

    // What a shape-only build would have written.
    const kept = logger.shapeEntries.filter(e => e.message.startsWith("structured-analytic"));
    assert.equal(kept.length, 1);
    assert.equal((kept[0].data as Record<string, unknown>).field, "limit");
  });

  await t.test("shape-labelled records carry no name, field, or filter value", () => {
    const logger = new CapturingLogger();
    validateAnalyticDefinition(base(), OPTIONS, logger);
    assert.throws(() => validateAnalyticDefinition({ ...base(), limit: 0 }, OPTIONS, logger));

    const serialized = JSON.stringify(logger.shapeEntries);
    for (const leaked of BASE_CONTENT) {
      assert.equal(serialized.includes(leaked), false, `shape record leaked ${leaked}`);
    }
  });

  // The probe above cannot detect the likeliest leak: `limit: 0` fails with a
  // content-free message. Several rules quote the offending name into their
  // message, so adding `reason` to the shape record would leak — and only a
  // rejection of this kind catches it.
  await t.test("a rejection whose message quotes a name still keeps it out of shape", () => {
    const logger = new CapturingLogger();
    assert.throws(() => validateAnalyticDefinition({
      ...base(),
      joins: [{ kind: "left", left: "Orders", right: "Orders", on: [{ leftField: "a", rightField: "b" }] }]
    }, OPTIONS, logger));

    const rejection = logger.shapeEntries.find(
      e => e.message === "structured-analytic.definition.rejected"
    );
    assert.ok(rejection);
    // Proves the message really does quote content, so the probe is meaningful.
    const detail = logger.contentEntries.find(
      e => e.message === "structured-analytic.definition.rejected.detail"
    );
    assert.match(String((detail?.data as Record<string, unknown>).reason), /Reps/);
    assert.equal(JSON.stringify(rejection).includes("Reps"), false);
  });

  await t.test("content-labelled records do carry it — that is the point", () => {
    const logger = new CapturingLogger();
    validateAnalyticDefinition(base(), OPTIONS, logger);

    const serialized = JSON.stringify(logger.contentEntries);
    for (const expected of BASE_CONTENT) {
      assert.equal(serialized.includes(expected), true, `content record omitted ${expected}`);
    }
  });

  await t.test("resolved limits are logged once, in full, and survive shape-only", () => {
    const logger = new CapturingLogger();
    validateAnalyticLimits(OPTIONS, logger);

    const entry = logger.entries.find(e => e.message === "structured-analytic.limits.resolved");
    assert.ok(entry);
    assert.equal(entry.level, "info");
    assert.deepEqual(entry.data, { ...OPTIONS });
    // Eight operator-set integers are shape by the platform's own taxonomy, and
    // the build where you cannot re-run this locally is the one that needs it.
    assert.equal(entry.detail, undefined);
  });

  await t.test("the logger is optional, so the domain stays callable as a pure function", () => {
    assert.doesNotThrow(() => validateAnalyticDefinition(base(), OPTIONS));
    assert.doesNotThrow(() => validateAnalyticLimits(OPTIONS));
  });

  await t.test("describeDefinition counts a self-join and recorded entry ids", () => {
    const definition = validateAnalyticDefinition({
      inputs: [{ name: "Orders", entryId: "e1" }, { name: "Orders", as: "Prior" }],
      joins: [{ kind: "inner", left: "Orders", right: "Prior", on: [{ leftField: "id", rightField: "id" }] }],
      columns: [{ id: "c", field: { input: "Prior", field: "region" }, aggregation: "none" }],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    }, OPTIONS);
    const shape = describeDefinition(definition);
    assert.equal(shape.selfJoinCount, 1);
    assert.equal(shape.inputsWithRecordedEntryId, 1);
    assert.equal(shape.hasLimit, false);
  });
});

// ─── Configuration ────────────────────────────────────────────────────────────

test("the shape limits are configuration, not constants", async (t) => {
  await t.test("the shipped YAML carries every limit and matches the defaults", async () => {
    const config = await loadBackendConfig();
    assert.deepEqual(
      Object.keys(config.structuredAnalytic).sort(),
      Object.keys(DEFAULT_STRUCTURED_ANALYTIC_LIMITS).sort()
    );
    assert.deepEqual(config.structuredAnalytic, DEFAULT_STRUCTURED_ANALYTIC_LIMITS);
  });

  // The type annotation that used to stand here proved nothing: apps/backend
  // tsconfig includes only src/**, and tests run under tsx, which strips types
  // without checking them. Only a runtime assertion means anything in this file.
  await t.test("the declared key list matches the defaults exactly", () => {
    assert.deepEqual(
      [...STRUCTURED_ANALYTIC_LIMIT_KEYS].sort(),
      Object.keys(DEFAULT_STRUCTURED_ANALYTIC_LIMITS).sort(),
      "a limit added to one and not the other is a check that silently stops running"
    );
  });

  await t.test("there is no per-project catalog cap, matching the Templates decision", () => {
    assert.equal("maxAnalyticsPerProject" in DEFAULT_STRUCTURED_ANALYTIC_LIMITS, false);
  });

  await t.test("configured limits actually bind", () => {
    rejectsWith(base(), /inputs: exceeds maxInputs \(1\)/, { ...OPTIONS, maxInputs: 1 });
    assert.throws(
      () => validateAnalyticDescription("a much longer description", { ...OPTIONS, maxDescriptionBytes: 4 }),
      AnalyticValidationError
    );
    // Title and description are bounded independently.
    assert.doesNotThrow(() =>
      validateAnalyticTitle("short", { ...OPTIONS, maxTitleBytes: 10, maxDescriptionBytes: 1 }));
  });
});

// ─── No project data is touched ───────────────────────────────────────────────

test("validation never requires the named data to exist", () => {
  // The whole point of the split: a definition stays editable while its source
  // is being renamed, rebuilt, or is temporarily broken.
  const definition = accepts(simple({ inputs: [{ name: "DoesNotExistAnywhere" }],
    columns: [{ id: "c", field: { input: "DoesNotExistAnywhere", field: "whatever" }, aggregation: "none" }] }));
  assert.equal(definition.inputs[0].name, "DoesNotExistAnywhere");
});

// ─── Round trip ───────────────────────────────────────────────────────────────

// One test that reads every field back off a validated definition.
//
// Almost every assertion in this file above was `doesNotThrow` or a message
// match, which proves a value is *accepted* and never that it is *preserved*.
// Swapping `leftField`/`rightField`, returning the wrong join kind, or dropping
// `caseSensitive` all passed the suite. This pins the whole object, and with it
// the collection ordering the compiler depends on.
test("a validated definition preserves every field, exactly", () => {
  const authored = {
    inputs: [
      { name: "Orders", entryId: "entry-7" },
      { name: "Orders", as: "Prior" }
    ],
    joins: [{
      kind: "inner",
      left: "Orders",
      right: "Prior",
      on: [
        { leftField: "repId", rightField: "id" },
        { leftField: "year", rightField: "priorYear" }
      ]
    }],
    columns: [
      { id: "c1", field: { input: "Orders", field: "region" }, aggregation: "none" }
    ],
    rows: [
      { id: "r1", field: { input: "Prior", field: "amount" }, aggregation: "sum", label: "Total" }
    ],
    filters: [
      { field: { input: "Orders", field: "status" }, operator: "notEquals", value: { kind: "text", value: "void" } },
      { field: { input: "Orders", field: "tier" }, operator: "in", values: [
        { kind: "text", value: "gold" },
        { kind: "number", numerator: "-7", denominator: "3" },
        { kind: "logic", value: true },
        { kind: "null" }
      ] },
      { field: { input: "Orders", field: "note" }, operator: "contains", value: "urgent", caseSensitive: true },
      { field: { input: "Prior", field: "closedAt" }, operator: "isNull" }
    ],
    sorts: [
      { placementId: "r1", direction: "desc" },
      { placementId: "c1", direction: "asc" }
    ],
    limit: 25,
    display: { kind: "bar" }
  };

  assert.deepEqual(accepts(authored), {
    inputs: [
      { name: "Orders", entryId: "entry-7" },
      { name: "Orders", as: "Prior" }
    ],
    joins: [{
      kind: "inner",
      left: "Orders",
      right: "Prior",
      on: [
        { leftField: "repId", rightField: "id" },
        { leftField: "year", rightField: "priorYear" }
      ]
    }],
    rows: [
      { id: "r1", field: { input: "Prior", field: "amount" }, aggregation: "sum", label: "Total" }
    ],
    columns: [
      { id: "c1", field: { input: "Orders", field: "region" }, aggregation: "none" }
    ],
    filters: [
      { field: { input: "Orders", field: "status" }, operator: "notEquals", value: { kind: "text", value: "void" } },
      { field: { input: "Orders", field: "tier" }, operator: "in", values: [
        { kind: "text", value: "gold" },
        { kind: "number", numerator: "-7", denominator: "3" },
        { kind: "logic", value: true },
        { kind: "null" }
      ] },
      { field: { input: "Orders", field: "note" }, operator: "contains", value: "urgent", caseSensitive: true },
      { field: { input: "Prior", field: "closedAt" }, operator: "isNull" }
    ],
    sorts: [
      { placementId: "r1", direction: "desc" },
      { placementId: "c1", direction: "asc" }
    ],
    limit: 25,
    display: { kind: "bar" }
  });
});

test("each enum value is stored as authored, not merely accepted", async (t) => {
  await t.test("join kind", () => {
    for (const kind of ANALYTIC_JOIN_KINDS) {
      const definition = accepts({
        inputs: [{ name: "A" }, { name: "B" }],
        joins: [{ kind, left: "A", right: "B", on: [{ leftField: "k", rightField: "k" }] }],
        columns: [{ id: "c", field: { input: "A", field: "k" }, aggregation: "none" }],
        rows: [], filters: [], sorts: [], display: { kind: "table" }
      });
      assert.equal(definition.joins[0].kind, kind);
    }
  });

  await t.test("aggregation", () => {
    for (const aggregation of ANALYTIC_AGGREGATIONS) {
      const definition = accepts(simple({
        columns: [{ id: "c", field: { input: "Orders", field: "region" }, aggregation }]
      }));
      assert.equal(definition.columns[0].aggregation, aggregation);
    }
  });

  await t.test("sort direction", () => {
    for (const direction of ANALYTIC_SORT_DIRECTIONS) {
      const definition = accepts(simple({ sorts: [{ placementId: "c1", direction }] }));
      assert.equal(definition.sorts[0].direction, direction);
    }
  });

  await t.test("display kind, over a definition legal for each", () => {
    for (const kind of ANALYTIC_DISPLAY_KINDS) {
      const measure = kind === "table" || kind === "scatter" ? "none" : "sum";
      const definition = accepts({
        inputs: [{ name: "A" }], joins: [],
        columns: [{ id: "c", field: { input: "A", field: "k" }, aggregation: "none" }],
        rows: [{ id: "r", field: { input: "A", field: "v" }, aggregation: measure }],
        filters: [], sorts: [], display: { kind }
      });
      assert.equal(definition.display.kind, kind);
    }
  });
});

// ─── Vocabulary parity with Formula ───────────────────────────────────────────

// The domain re-declares four vocabularies that compilation turns directly into
// Formula builtin options. A rename on either side would otherwise produce
// definitions that save cleanly and fail at pull time, per analytic, forever —
// the exact failure mode `isBuiltinName` was exported to prevent.
test("the domain's vocabularies match the Formula builtins they compile into", async (t) => {
  await t.test("filter operators are WHERE's operators", () => {
    assert.deepEqual([...ANALYTIC_FILTER_OPERATORS].sort(), [...WHERE_OPS].sort());
  });

  await t.test("aggregations are AGGREGATE's functions, plus `none`", () => {
    const aggregating = ANALYTIC_AGGREGATIONS.filter(name => name !== "none");
    assert.deepEqual([...aggregating].sort(), [...AGGREGATE_FNS].sort());
    assert.equal(ANALYTIC_AGGREGATIONS.includes("none"), true);
  });

  await t.test("sort directions are SORT's directions", () => {
    assert.deepEqual([...ANALYTIC_SORT_DIRECTIONS].sort(), [...SORT_DIRECTIONS].sort());
  });

  await t.test("display kinds are the Formula engine's display kinds", () => {
    assert.deepEqual([...ANALYTIC_DISPLAY_KINDS].sort(), [...DISPLAY_KINDS].sort());
    for (const kind of ANALYTIC_DISPLAY_KINDS) assert.equal(isDisplayKind(kind), true);
  });
});

// ─── Byte limits ──────────────────────────────────────────────────────────────

test("limits are counted in bytes, and bind at every name site", async (t) => {
  await t.test("the boundary is inclusive", () => {
    assert.equal(validateAnalyticTitle("x".repeat(10), { ...OPTIONS, maxTitleBytes: 10 }), "x".repeat(10));
    assert.throws(
      () => validateAnalyticTitle("x".repeat(11), { ...OPTIONS, maxTitleBytes: 10 }),
      AnalyticValidationError
    );
  });

  // The whole reason the limit is expressed in bytes. "é" is one UTF-16 unit
  // and two UTF-8 bytes, so `.length` would let twice as much through.
  await t.test("multibyte characters are counted as their encoded bytes", () => {
    const limits = { ...OPTIONS, maxTitleBytes: 5 };
    assert.equal(validateAnalyticTitle("éé", limits), "éé");
    assert.throws(() => validateAnalyticTitle("ééé", limits), AnalyticValidationError);
    // An astral character is four bytes but two UTF-16 units.
    assert.throws(() => validateAnalyticTitle("😀😀", limits), AnalyticValidationError);
  });

  await t.test("maxNameBytes binds at every site that uses it", () => {
    const limits = { ...OPTIONS, maxNameBytes: 4 };
    const long = "toolongname";
    const cases: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ["inputs[0].name", simple({ inputs: [{ name: long }],
        columns: [{ id: "c", field: { input: long, field: "a" }, aggregation: "none" }] })],
      ["inputs[0].entryId", simple({ inputs: [{ name: "Ord", entryId: long }],
        columns: [{ id: "c", field: { input: "Ord", field: "a" }, aggregation: "none" }] })],
      ["inputs[1].as", { inputs: [{ name: "Ord" }, { name: "Ord", as: long }],
        joins: [{ kind: "inner", left: "Ord", right: long, on: [{ leftField: "a", rightField: "a" }] }],
        columns: [{ id: "c", field: { input: "Ord", field: "a" }, aggregation: "none" }],
        rows: [], filters: [], sorts: [], display: { kind: "table" } }],
      ["columns[0].id", simple({ columns: [{ id: long, field: { input: "Ord", field: "a" }, aggregation: "none" }],
        inputs: [{ name: "Ord" }] })],
      ["columns[0].field.field", simple({ inputs: [{ name: "Ord" }],
        columns: [{ id: "c", field: { input: "Ord", field: long }, aggregation: "none" }] })],
      ["columns[0].label", simple({ inputs: [{ name: "Ord" }],
        columns: [{ id: "c", field: { input: "Ord", field: "a" }, aggregation: "none", label: long }] })],
      ["joins[0].on[0].leftField", { inputs: [{ name: "Ord" }, { name: "Rep" }],
        joins: [{ kind: "inner", left: "Ord", right: "Rep", on: [{ leftField: long, rightField: "a" }] }],
        columns: [{ id: "c", field: { input: "Ord", field: "a" }, aggregation: "none" }],
        rows: [], filters: [], sorts: [], display: { kind: "table" } }],
      ["sorts[0].placementId", simple({ inputs: [{ name: "Ord" }],
        columns: [{ id: "c", field: { input: "Ord", field: "a" }, aggregation: "none" }],
        sorts: [{ placementId: long, direction: "asc" }] })]
    ];

    for (const [field, definition] of cases) {
      rejects(definition, /exceeds its 4-byte limit/, field, limits);
    }
  });

  await t.test("a filter literal is bounded too, so a definition has a total size", () => {
    const limits = { ...OPTIONS, maxScalarBytes: 8 };
    const ref = { input: "Orders", field: "status" };
    rejects(
      simple({ filters: [{ field: ref, operator: "equals", value: { kind: "text", value: "x".repeat(9) } }] }),
      /exceeds its 8-byte limit/,
      "filters[0].value.value",
      limits
    );
    rejects(
      simple({ filters: [{ field: ref, operator: "contains", value: "x".repeat(9), caseSensitive: false }] }),
      /exceeds its 8-byte limit/,
      "filters[0].value",
      limits
    );
    rejects(
      simple({ filters: [{ field: ref, operator: "equals",
        value: { kind: "number", numerator: "1".repeat(9), denominator: "1" } }] }),
      /exceeds its 8-byte limit/,
      "filters[0].value.numerator",
      limits
    );
  });

  await t.test("maxFilterValues bounds an `in` list", () => {
    const ref = { input: "Orders", field: "tier" };
    const values = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ kind: "text", value: `t${index}` }));
    const limits = { ...OPTIONS, maxFilterValues: 3 };
    accepts(simple({ filters: [{ field: ref, operator: "in", values: values(3) }] }), limits);
    rejects(
      simple({ filters: [{ field: ref, operator: "in", values: values(4) }] }),
      /exceeds maxFilterValues \(3\)/,
      "filters[0].values",
      limits
    );
  });
});

// ─── Structural guards ────────────────────────────────────────────────────────

// Each of these is a 400-vs-500 distinction at the job-wiring boundary: remove
// or reorder any guard and the same input yields a raw TypeError instead.
test("every structural guard yields a validation error, never a TypeError", () => {
  const ref = { input: "Orders", field: "a" };
  const one = { id: "c1", field: { input: "Orders", field: "region" }, aggregation: "none" };
  const cases: ReadonlyArray<readonly [string, unknown, string]> = [
    ["definition", null, "definition"],
    ["definition is an array", [], "inputs"],
    ["inputs[0] not an object", simple({ inputs: ["Orders"] }), "inputs[0]"],
    ["joins not an array", simple({ joins: {} }), "joins"],
    ["joins[0] not an object", { ...base(), joins: [null] }, "joins[0]"],
    ["joins[0].on[0] not an object", { ...base(),
      joins: [{ kind: "left", left: "Orders", right: "Reps", on: ["k"] }] }, "joins[0].on[0]"],
    ["rows not an array", simple({ rows: {} }), "rows"],
    ["columns not an array", simple({ columns: {} }), "columns"],
    ["columns[0] not an object", simple({ columns: ["c1"] }), "columns[0]"],
    ["placement field not an object", simple({
      columns: [{ id: "c", field: "amount", aggregation: "none" }] }), "columns[0].field"],
    ["filters not an array", simple({ filters: {} }), "filters"],
    ["filters[0] not an object", simple({ filters: [null] }), "filters[0]"],
    ["sorts not an array", simple({ sorts: {} }), "sorts"],
    ["sorts[0] not an object", simple({ columns: [one], sorts: [null] }), "sorts[0]"],
    ["display not an object", simple({ display: null }), "display"],
    ["display is an array", simple({ display: [] }), "display.kind"],
    ["scalar not an object", simple({
      filters: [{ field: ref, operator: "equals", value: "closed" }] }), "filters[0].value"],
    ["scalar value missing", simple({
      filters: [{ field: ref, operator: "equals" }] }), "filters[0].value"],
    ["aggregation missing", simple({
      columns: [{ id: "c", field: ref }] }), "columns[0].aggregation"]
  ];

  for (const [label, definition, expectedField] of cases) {
    assert.throws(
      () => validateAnalyticDefinition(definition, OPTIONS),
      (error: unknown) => {
        assert.ok(error instanceof AnalyticValidationError, `${label} threw ${String(error)}`);
        assert.equal(error.field, expectedField, label);
        return true;
      },
      label
    );
  }
});

// ─── Remaining gaps ───────────────────────────────────────────────────────────

test("the logic scalar kind is validated like the other three", async (t) => {
  const ref = { input: "Orders", field: "active" };

  await t.test("a boolean is accepted and preserved", () => {
    for (const value of [true, false]) {
      const definition = accepts(simple({
        filters: [{ field: ref, operator: "equals", value: { kind: "logic", value } }]
      }));
      assert.deepEqual(definition.filters[0], {
        field: ref, operator: "equals", value: { kind: "logic", value }
      });
    }
  });

  await t.test("a stringly-typed boolean is refused", () => {
    rejects(
      simple({ filters: [{ field: ref, operator: "equals", value: { kind: "logic", value: "true" } }] }),
      /must be a boolean/,
      "filters[0].value.value"
    );
  });

  await t.test("a null literal is accepted under a real operator", () => {
    const definition = accepts(simple({
      filters: [{ field: ref, operator: "notEquals", value: { kind: "null" } }]
    }));
    assert.deepEqual(definition.filters[0].value, { kind: "null" });
  });

  await t.test("a text literal may be empty or blank — a filter can match those", () => {
    for (const value of ["", "   "]) {
      const definition = accepts(simple({
        filters: [{ field: ref, operator: "equals", value: { kind: "text", value } }]
      }));
      assert.deepEqual(definition.filters[0].value, { kind: "text", value });
    }
  });
});

test("an unknown filter operator is told about all ten, not only the six comparisons", () => {
  rejects(
    simple({ filters: [{ field: { input: "Orders", field: "a" }, operator: "IN", values: [] }] }),
    /in, contains, isNull, isNotNull/,
    "filters[0].operator"
  );
});

test("an `as` label colliding with another input's name is a duplicate key", () => {
  rejects(
    {
      inputs: [{ name: "A" }, { name: "B", as: "a" }],
      joins: [{ kind: "inner", left: "A", right: "a", on: [{ leftField: "k", rightField: "k" }] }],
      columns: [{ id: "c", field: { input: "A", field: "k" }, aggregation: "none" }],
      rows: [], filters: [], sorts: [], display: { kind: "table" }
    },
    /duplicate input key: a/,
    "inputs[1]"
  );
});

test("limit accepts the whole safe-integer range and nothing outside it", () => {
  assert.equal(accepts(simple({ limit: 1 })).limit, 1);
  assert.equal(accepts(simple({ limit: Number.MAX_SAFE_INTEGER })).limit, Number.MAX_SAFE_INTEGER);
  // The reason isSafeInteger was chosen over isInteger: this is a whole number.
  rejects(simple({ limit: Number.MAX_SAFE_INTEGER + 1 }), /must be a positive integer/, "limit");
  rejects(simple({ limit: Number.POSITIVE_INFINITY }), /must be a positive integer/, "limit");
});

test("a chart's second requirement is enforced, not only its first", async (t) => {
  const dimension = (id: string) => ({
    id, field: { input: "A", field: id }, aggregation: "none"
  });
  const measure = (id: string) => ({
    id, field: { input: "A", field: id }, aggregation: "sum"
  });
  const shelves = (columns: unknown[], rows: unknown[], kind: string) => ({
    inputs: [{ name: "A" }], joins: [], columns, rows,
    filters: [], sorts: [], display: { kind }
  });

  // The commonest authoring mistake: the right number of pills, but the Rows
  // pill was never aggregated. Both existing cases had the wrong count, so they
  // fired on the first disjunct and this one never ran.
  await t.test("one non-aggregated Rows placement is refused for bar, line, area, pie", () => {
    for (const kind of ["bar", "line", "area", "pie"]) {
      rejects(
        shelves([dimension("c")], [dimension("r")], kind),
        new RegExp(`a ${kind} requires exactly one aggregated Rows placement`),
        "display"
      );
    }
  });

  await t.test("an aggregated Columns placement is refused for bar, line, area, pie", () => {
    for (const kind of ["bar", "line", "area", "pie"]) {
      rejects(
        shelves([measure("c")], [measure("r")], kind),
        new RegExp(`a ${kind} requires exactly one non-aggregated Columns placement`),
        "display"
      );
    }
  });

  await t.test("a scatter refuses an aggregated placement on either shelf", () => {
    rejects(
      shelves([measure("c")], [dimension("r")], "scatter"),
      /scatter requires exactly one non-aggregated Columns/,
      "display"
    );
    rejects(
      shelves([dimension("c")], [measure("r")], "scatter"),
      /scatter requires exactly one non-aggregated Rows/,
      "display"
    );
  });
});
