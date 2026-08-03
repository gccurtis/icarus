import assert from "node:assert/strict";
import test from "node:test";
import { AnalyticValidationError } from "../../src/3-capabilities/structured-analytic/domain/errors.js";
import {
  DEFAULT_STRUCTURED_ANALYTIC_OPTIONS,
  inputKey,
  placementName
} from "../../src/3-capabilities/structured-analytic/domain/model.js";
import type {
  AnalyticFieldPlacement,
  StructuredAnalyticOptions
} from "../../src/3-capabilities/structured-analytic/domain/model.js";
import {
  describeDefinition,
  normalizeInputKey,
  validateAnalyticDefinition,
  validateAnalyticDescription,
  validateAnalyticOptions,
  validateAnalyticTitle
} from "../../src/3-capabilities/structured-analytic/domain/validation.js";
import { loadBackendConfig } from "../../src/0-utils/config/loadBackendConfig.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const OPTIONS = DEFAULT_STRUCTURED_ANALYTIC_OPTIONS;

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

const accepts = (definition: unknown, options: StructuredAnalyticOptions = OPTIONS) =>
  validateAnalyticDefinition(definition, options);

const rejects = (
  definition: unknown,
  field: RegExp,
  options: StructuredAnalyticOptions = OPTIONS
): void => {
  assert.throws(
    () => validateAnalyticDefinition(definition, options),
    (error: unknown) =>
      error instanceof AnalyticValidationError && field.test(error.message),
    `expected a validation error matching ${field}`
  );
};

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
    rejects(definition, /inputs: exceeds maxInputs \(2\)/, { ...OPTIONS, maxInputs: 2 });
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
    rejects(withOn([]), /joins\[0\]\.on: must not be empty/);
    rejects(withOn({}), /joins\[0\]\.on: must be an array/);
    rejects(
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
      /duplicate placement id across Rows and Columns: same/
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
    rejects(definition, /exceed maxPlacements \(1\)/, { ...OPTIONS, maxPlacements: 1 });
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
      /numerator: must be an integer string/
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
    rejects(simple({ filters: [one, one] }), /filters: exceeds maxFilters \(1\)/, { ...OPTIONS, maxFilters: 1 });
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
    rejects({ ...base(), sorts: [sort, sort] }, /sorts: exceeds maxSorts \(1\)/, { ...OPTIONS, maxSorts: 1 });
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

  await t.test("every option must be a positive safe integer", () => {
    assert.doesNotThrow(() => validateAnalyticOptions(OPTIONS));
    assert.throws(() => validateAnalyticOptions({ ...OPTIONS, maxInputs: 0 }), AnalyticValidationError);
    assert.throws(() => validateAnalyticOptions({ ...OPTIONS, maxSorts: 1.5 }), AnalyticValidationError);
  });
});

// ─── Observability ────────────────────────────────────────────────────────────

test("validation reports its shape without ever logging content", async (t) => {
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

  await t.test("a rejected definition logs the rule that fired, at warn", () => {
    const logger = new CapturingLogger();
    assert.throws(() => validateAnalyticDefinition({ ...base(), inputs: [] }, OPTIONS, logger));

    const entry = logger.entries.find(e => e.message === "structured-analytic.definition.rejected");
    assert.ok(entry, "expected a rejected event");
    assert.equal(entry.level, "warn");
    const data = entry.data as Record<string, unknown>;
    assert.equal(data.field, "inputs");
    assert.equal(data.errorName, "AnalyticValidationError");
  });

  await t.test("no log record contains a name, title, field, or filter value", () => {
    const logger = new CapturingLogger();
    validateAnalyticDefinition(base(), OPTIONS, logger);
    assert.throws(() => validateAnalyticDefinition({ ...base(), limit: 0 }, OPTIONS, logger));

    const serialized = JSON.stringify(logger.entries);
    for (const secret of ["Orders", "Reps", "region", "amount", "repId", "closed", "Total"]) {
      assert.equal(serialized.includes(secret), false, `log leaked ${secret}`);
    }
  });

  await t.test("the logger is optional, so the domain stays callable as a pure function", () => {
    assert.doesNotThrow(() => validateAnalyticDefinition(base(), OPTIONS));
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
      Object.keys(DEFAULT_STRUCTURED_ANALYTIC_OPTIONS).sort()
    );
    assert.deepEqual(config.structuredAnalytic, DEFAULT_STRUCTURED_ANALYTIC_OPTIONS);
  });

  await t.test("the domain options type and the config section stay the same shape", () => {
    // If one gains a field and the other does not, this fails rather than the
    // limit silently becoming unconfigurable.
    const fromConfig: StructuredAnalyticOptions = DEFAULT_STRUCTURED_ANALYTIC_OPTIONS;
    assert.equal(typeof fromConfig.maxDescriptionBytes, "number");
  });

  await t.test("there is no per-project catalog cap, matching the Templates decision", () => {
    assert.equal("maxAnalyticsPerProject" in DEFAULT_STRUCTURED_ANALYTIC_OPTIONS, false);
  });

  await t.test("configured limits actually bind", () => {
    rejects(base(), /inputs: exceeds maxInputs \(1\)/, { ...OPTIONS, maxInputs: 1 });
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
