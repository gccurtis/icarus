// Structural validation of a saved definition.
//
// This checks the *recipe*, never the ingredients: no project data is read and
// no name is required to exist. A definition stays editable while its source is
// being renamed, rebuilt, or is temporarily broken.
//
// The complementary half — does this evaluate against the data as it is right
// now — happens during a pull and fails differently on purpose.

import { AnalyticValidationError } from "./errors.js";
import {
  ANALYTIC_AGGREGATIONS,
  ANALYTIC_COMPARISON_OPERATORS,
  ANALYTIC_DISPLAY_KINDS,
  ANALYTIC_JOIN_KINDS,
  ANALYTIC_SORT_DIRECTIONS,
  inputKey,
  type AnalyticDefinition,
  type AnalyticFieldPlacement,
  type AnalyticFieldRef,
  type AnalyticFilter,
  type AnalyticScalar,
  type StructuredAnalyticOptions
} from "./model.js";

/** Names are matched the way Structured Data and the Formula resolver match them. */
export const normalizeInputKey = (key: string): string => key.trim().toLowerCase();

const fail = (field: string, message: string): never => {
  throw new AnalyticValidationError(field, message);
};

const boundedText = (
  value: unknown,
  field: string,
  maxBytes: number
): string => {
  if (typeof value !== "string") fail(field, "must be a string");
  const trimmed = (value as string).trim();
  if (trimmed.length === 0) fail(field, "must not be blank");
  if (Buffer.byteLength(trimmed, "utf8") > maxBytes) {
    fail(field, `exceeds its ${maxBytes}-byte limit`);
  }
  return trimmed;
};

const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T => {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    fail(field, `must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
};

const positiveInteger = (value: unknown, field: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    fail(field, "must be a positive integer");
  }
  return value as number;
};

const INTEGER_STRING = /^-?(?:0|[1-9][0-9]*)$/;
const POSITIVE_INTEGER_STRING = /^[1-9][0-9]*$/;

/**
 * A number literal is a numerator/denominator pair rather than a float, so it
 * survives compilation as an exact division expression. Reduction is not
 * required: nothing compares stored literals for identity.
 */
const validateScalar = (value: unknown, field: string): AnalyticScalar => {
  if (typeof value !== "object" || value === null) fail(field, "must be a scalar value");
  const raw = value as Record<string, unknown>;
  switch (raw.kind) {
    case "null":
      return { kind: "null" };
    case "text":
      if (typeof raw.value !== "string") fail(`${field}.value`, "must be a string");
      return { kind: "text", value: raw.value as string };
    case "logic":
      if (typeof raw.value !== "boolean") fail(`${field}.value`, "must be a boolean");
      return { kind: "logic", value: raw.value as boolean };
    case "number": {
      if (typeof raw.numerator !== "string" || !INTEGER_STRING.test(raw.numerator)) {
        fail(`${field}.numerator`, "must be an integer string");
      }
      if (
        typeof raw.denominator !== "string" ||
        !POSITIVE_INTEGER_STRING.test(raw.denominator)
      ) {
        fail(`${field}.denominator`, "must be a positive integer string");
      }
      return {
        kind: "number",
        numerator: raw.numerator as string,
        denominator: raw.denominator as string
      };
    }
    default:
      return fail(`${field}.kind`, "must be null, number, text, or logic");
  }
};

const validateFieldRef = (
  value: unknown,
  field: string,
  declaredKeys: ReadonlySet<string>,
  options: StructuredAnalyticOptions
): AnalyticFieldRef => {
  if (typeof value !== "object" || value === null) fail(field, "must be an object");
  const raw = value as Record<string, unknown>;
  const input = boundedText(raw.input, `${field}.input`, options.maxNameBytes);
  if (!declaredKeys.has(normalizeInputKey(input))) {
    fail(`${field}.input`, `names no declared input: ${input}`);
  }
  // Field names come from inside a table value, not the project name space, so
  // they are matched case-sensitively and Formula does not normalize them.
  const name = boundedText(raw.field, `${field}.field`, options.maxNameBytes);
  return { input, field: name };
};

const validatePlacement = (
  value: unknown,
  field: string,
  declaredKeys: ReadonlySet<string>,
  options: StructuredAnalyticOptions
): AnalyticFieldPlacement => {
  if (typeof value !== "object" || value === null) fail(field, "must be an object");
  const raw = value as Record<string, unknown>;
  const id = boundedText(raw.id, `${field}.id`, options.maxNameBytes);
  const ref = validateFieldRef(raw.field, `${field}.field`, declaredKeys, options);
  const aggregation = oneOf(raw.aggregation, ANALYTIC_AGGREGATIONS, `${field}.aggregation`);
  const placement: AnalyticFieldPlacement = { id, field: ref, aggregation };
  if (raw.label === undefined) return placement;
  return { ...placement, label: boundedText(raw.label, `${field}.label`, options.maxNameBytes) };
};

const validateFilter = (
  value: unknown,
  field: string,
  declaredKeys: ReadonlySet<string>,
  options: StructuredAnalyticOptions
): AnalyticFilter => {
  if (typeof value !== "object" || value === null) fail(field, "must be an object");
  const raw = value as Record<string, unknown>;
  const ref = validateFieldRef(raw.field, `${field}.field`, declaredKeys, options);
  const operator = raw.operator;

  if (operator === "isNull" || operator === "isNotNull") {
    return { field: ref, operator };
  }
  if (operator === "in") {
    if (!Array.isArray(raw.values)) fail(`${field}.values`, "must be an array");
    const values = raw.values as unknown[];
    if (values.length === 0) fail(`${field}.values`, "must not be empty");
    return {
      field: ref,
      operator: "in",
      values: values.map((entry, index) => validateScalar(entry, `${field}.values[${index}]`))
    };
  }
  if (operator === "contains") {
    if (typeof raw.value !== "string") fail(`${field}.value`, "must be a string");
    if (typeof raw.caseSensitive !== "boolean") {
      fail(`${field}.caseSensitive`, "must be a boolean");
    }
    return {
      field: ref,
      operator: "contains",
      value: raw.value as string,
      caseSensitive: raw.caseSensitive as boolean
    };
  }
  return {
    field: ref,
    operator: oneOf(operator, ANALYTIC_COMPARISON_OPERATORS, `${field}.operator`),
    value: validateScalar(raw.value, `${field}.value`)
  };
};

/**
 * The display's structural contract: counts of placements and their aggregation
 * flags, which are facts about the recipe. Whether a measure actually resolved
 * to numbers depends on the data and is checked during a pull.
 *
 * A definition failing this can never render for any data, which is why it is
 * refused at save rather than on every pull forever after.
 */
const validateDisplayContract = (
  definition: Pick<AnalyticDefinition, "rows" | "columns" | "display">
): void => {
  const { rows, columns, display } = definition;
  const measures = (list: readonly AnalyticFieldPlacement[]) =>
    list.filter(placement => placement.aggregation !== "none");
  const dimensions = (list: readonly AnalyticFieldPlacement[]) =>
    list.filter(placement => placement.aggregation === "none");

  if (display.kind === "table") {
    if (rows.length + columns.length === 0) {
      fail("display", "a table requires at least one Rows or Columns placement");
    }
    return;
  }

  if (display.kind === "scatter") {
    if (dimensions(columns).length !== 1 || columns.length !== 1) {
      fail("display", "a scatter requires exactly one non-aggregated Columns placement");
    }
    if (dimensions(rows).length !== 1 || rows.length !== 1) {
      fail("display", "a scatter requires exactly one non-aggregated Rows placement");
    }
    return;
  }

  // bar, line, area, pie
  if (columns.length !== 1 || dimensions(columns).length !== 1) {
    fail("display", `a ${display.kind} requires exactly one non-aggregated Columns placement`);
  }
  if (rows.length !== 1 || measures(rows).length !== 1) {
    fail("display", `a ${display.kind} requires exactly one aggregated Rows placement`);
  }
};

export const validateAnalyticDefinition = (
  value: unknown,
  options: StructuredAnalyticOptions
): AnalyticDefinition => {
  if (typeof value !== "object" || value === null) fail("definition", "must be an object");
  const raw = value as Record<string, unknown>;

  // ── Inputs ──────────────────────────────────────────────────────────────
  if (!Array.isArray(raw.inputs)) fail("inputs", "must be an array");
  const rawInputs = raw.inputs as unknown[];
  if (rawInputs.length === 0) fail("inputs", "must not be empty");
  if (rawInputs.length > options.maxInputs) {
    fail("inputs", `exceeds maxInputs (${options.maxInputs})`);
  }

  const declaredKeys = new Set<string>();
  const inputs = rawInputs.map((entry, index) => {
    const field = `inputs[${index}]`;
    if (typeof entry !== "object" || entry === null) fail(field, "must be an object");
    const rawInput = entry as Record<string, unknown>;
    const name = boundedText(rawInput.name, `${field}.name`, options.maxNameBytes);
    const alias =
      rawInput.as === undefined
        ? undefined
        : boundedText(rawInput.as, `${field}.as`, options.maxNameBytes);
    const entryId =
      rawInput.entryId === undefined
        ? undefined
        : boundedText(rawInput.entryId, `${field}.entryId`, options.maxNameBytes);

    const key = normalizeInputKey(alias ?? name);
    if (declaredKeys.has(key)) {
      fail(field, `duplicate input key: ${alias ?? name}`);
    }
    declaredKeys.add(key);

    return {
      name,
      ...(alias !== undefined ? { as: alias } : {}),
      ...(entryId !== undefined ? { entryId } : {})
    };
  });

  // ── Joins ───────────────────────────────────────────────────────────────
  // Left-deep and ordered: joins[i] introduces inputs[i+1]. Validating the
  // shape is what makes cycles and disconnected inputs unrepresentable, rather
  // than something a planner has to detect later.
  if (!Array.isArray(raw.joins)) fail("joins", "must be an array");
  const rawJoins = raw.joins as unknown[];
  if (rawJoins.length !== inputs.length - 1) {
    fail(
      "joins",
      `must introduce every input after the first: expected ${inputs.length - 1}, got ${rawJoins.length}`
    );
  }

  const introduced = new Set<string>([normalizeInputKey(inputKey(inputs[0]))]);
  const joins = rawJoins.map((entry, index) => {
    const field = `joins[${index}]`;
    if (typeof entry !== "object" || entry === null) fail(field, "must be an object");
    const rawJoin = entry as Record<string, unknown>;
    const kind = oneOf(rawJoin.kind, ANALYTIC_JOIN_KINDS, `${field}.kind`);
    const left = boundedText(rawJoin.left, `${field}.left`, options.maxNameBytes);
    const right = boundedText(rawJoin.right, `${field}.right`, options.maxNameBytes);

    if (!introduced.has(normalizeInputKey(left))) {
      fail(`${field}.left`, `is not introduced yet: ${left}`);
    }
    const expectedRight = inputKey(inputs[index + 1]);
    if (normalizeInputKey(right) !== normalizeInputKey(expectedRight)) {
      fail(`${field}.right`, `must introduce ${expectedRight}, got ${right}`);
    }
    introduced.add(normalizeInputKey(right));

    if (!Array.isArray(rawJoin.on)) fail(`${field}.on`, "must be an array");
    const rawKeys = rawJoin.on as unknown[];
    if (rawKeys.length === 0) fail(`${field}.on`, "must not be empty");
    if (rawKeys.length > options.maxJoinKeys) {
      fail(`${field}.on`, `exceeds maxJoinKeys (${options.maxJoinKeys})`);
    }
    const on = rawKeys.map((keyEntry, keyIndex) => {
      const keyField = `${field}.on[${keyIndex}]`;
      if (typeof keyEntry !== "object" || keyEntry === null) {
        fail(keyField, "must be an object");
      }
      const rawKey = keyEntry as Record<string, unknown>;
      return {
        leftField: boundedText(rawKey.leftField, `${keyField}.leftField`, options.maxNameBytes),
        rightField: boundedText(rawKey.rightField, `${keyField}.rightField`, options.maxNameBytes)
      };
    });

    return { kind, left, right, on };
  });

  // ── Shelves ─────────────────────────────────────────────────────────────
  if (!Array.isArray(raw.rows)) fail("rows", "must be an array");
  if (!Array.isArray(raw.columns)) fail("columns", "must be an array");
  const rawRows = raw.rows as unknown[];
  const rawColumns = raw.columns as unknown[];
  if (rawRows.length + rawColumns.length > options.maxPlacements) {
    fail("rows", `Rows and Columns together exceed maxPlacements (${options.maxPlacements})`);
  }

  const rows = rawRows.map((entry, index) =>
    validatePlacement(entry, `rows[${index}]`, declaredKeys, options));
  const columns = rawColumns.map((entry, index) =>
    validatePlacement(entry, `columns[${index}]`, declaredKeys, options));

  const placementIds = new Set<string>();
  for (const placement of [...rows, ...columns]) {
    if (placementIds.has(placement.id)) {
      fail("rows", `duplicate placement id across Rows and Columns: ${placement.id}`);
    }
    placementIds.add(placement.id);
  }

  // ── Filters ─────────────────────────────────────────────────────────────
  if (!Array.isArray(raw.filters)) fail("filters", "must be an array");
  const rawFilters = raw.filters as unknown[];
  if (rawFilters.length > options.maxFilters) {
    fail("filters", `exceeds maxFilters (${options.maxFilters})`);
  }
  const filters = rawFilters.map((entry, index) =>
    validateFilter(entry, `filters[${index}]`, declaredKeys, options));

  // ── Sorts ───────────────────────────────────────────────────────────────
  if (!Array.isArray(raw.sorts)) fail("sorts", "must be an array");
  const rawSorts = raw.sorts as unknown[];
  if (rawSorts.length > options.maxSorts) {
    fail("sorts", `exceeds maxSorts (${options.maxSorts})`);
  }
  const sorts = rawSorts.map((entry, index) => {
    const field = `sorts[${index}]`;
    if (typeof entry !== "object" || entry === null) fail(field, "must be an object");
    const rawSort = entry as Record<string, unknown>;
    const placementId = boundedText(rawSort.placementId, `${field}.placementId`, options.maxNameBytes);
    if (!placementIds.has(placementId)) {
      fail(`${field}.placementId`, `names no declared placement: ${placementId}`);
    }
    return {
      placementId,
      direction: oneOf(rawSort.direction, ANALYTIC_SORT_DIRECTIONS, `${field}.direction`)
    };
  });

  // ── Limit and display ───────────────────────────────────────────────────
  const limit = raw.limit === undefined ? undefined : positiveInteger(raw.limit, "limit");

  if (typeof raw.display !== "object" || raw.display === null) {
    fail("display", "must be an object");
  }
  const display = {
    kind: oneOf(
      (raw.display as Record<string, unknown>).kind,
      ANALYTIC_DISPLAY_KINDS,
      "display.kind"
    )
  };

  const definition: AnalyticDefinition = {
    inputs,
    joins,
    rows,
    columns,
    filters,
    sorts,
    ...(limit !== undefined ? { limit } : {}),
    display
  };

  validateDisplayContract(definition);
  return definition;
};

export const validateAnalyticTitle = (
  value: unknown,
  options: StructuredAnalyticOptions
): string => boundedText(value, "title", options.maxTitleBytes);

export const validateAnalyticDescription = (
  value: unknown,
  options: StructuredAnalyticOptions
): string | undefined =>
  value === undefined ? undefined : boundedText(value, "description", options.maxTitleBytes);

export const validateAnalyticOptions = (options: StructuredAnalyticOptions): void => {
  for (const [name, value] of Object.entries(options)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      fail(`options.${name}`, "must be a positive safe integer");
    }
  }
};
