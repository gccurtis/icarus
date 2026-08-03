// Structural validation of a saved definition.
//
// This checks the *recipe*, never the ingredients: no project data is read and
// no name is required to exist. A definition stays editable while its source is
// being renamed, rebuilt, or is temporarily broken.
//
// The complementary half — does this evaluate against the data as it is right
// now — happens during a pull and fails differently on purpose.

import type { Logger } from "#platform/observability/logger.js";
import { normalizeDisplayNameKey } from "#structured-data";
import { AnalyticConfigurationError, AnalyticValidationError } from "./errors.js";
import {
  ANALYTIC_AGGREGATIONS,
  ANALYTIC_DISPLAY_KINDS,
  ANALYTIC_FILTER_OPERATORS,
  ANALYTIC_JOIN_KINDS,
  ANALYTIC_SORT_DIRECTIONS,
  STRUCTURED_ANALYTIC_LIMIT_KEYS,
  inputKey,
  type AnalyticDefinition,
  type AnalyticFieldPlacement,
  type AnalyticFieldRef,
  type AnalyticFilter,
  type AnalyticScalar,
  type StructuredAnalyticLimits
} from "./model.js";

/**
 * Names are matched the way Structured Data and the Formula resolver match
 * them — by delegating, not by agreeing. An input key is resolved against a
 * Structured Data display name at pull time, so if that normalization ever
 * gains Unicode folding, a private copy here would silently stop resolving
 * inputs with no error anywhere to notice.
 */
export const normalizeInputKey = (key: string): string => normalizeDisplayNameKey(key);

// Annotated on the binding rather than on the arrow so TypeScript narrows at
// call sites: without this, every `fail(...)` looks like it returns, and the
// `as` casts that follow one become load-bearing rather than cosmetic.
const fail: (field: string, reason: string) => never = (field, reason) => {
  throw new AnalyticValidationError(field, reason);
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
const validateScalar = (
  value: unknown,
  field: string,
  options: StructuredAnalyticLimits
): AnalyticScalar => {
  if (typeof value !== "object" || value === null) fail(field, "must be a scalar value");
  const raw = value as Record<string, unknown>;
  // Literals are bounded like everything else. Without this a definition has no
  // total size: names are capped at 256 bytes while a single filter value, or a
  // rational's digit string, could be arbitrarily long.
  const boundedLiteral = (text: unknown, at: string): string => {
    if (typeof text !== "string") fail(at, "must be a string");
    if (Buffer.byteLength(text as string, "utf8") > options.maxScalarBytes) {
      fail(at, `exceeds its ${options.maxScalarBytes}-byte limit`);
    }
    return text as string;
  };

  switch (raw.kind) {
    case "null":
      return { kind: "null" };
    case "text":
      // Not `boundedText`: a filter may legitimately match the empty string or
      // one made of spaces, so this neither trims nor requires non-blank.
      return { kind: "text", value: boundedLiteral(raw.value, `${field}.value`) };
    case "logic":
      if (typeof raw.value !== "boolean") fail(`${field}.value`, "must be a boolean");
      return { kind: "logic", value: raw.value as boolean };
    case "number": {
      const numerator = boundedLiteral(raw.numerator, `${field}.numerator`);
      if (!INTEGER_STRING.test(numerator)) {
        fail(`${field}.numerator`, "must be an integer string");
      }
      const denominator = boundedLiteral(raw.denominator, `${field}.denominator`);
      if (!POSITIVE_INTEGER_STRING.test(denominator)) {
        fail(`${field}.denominator`, "must be a positive integer string");
      }
      return { kind: "number", numerator, denominator };
    }
    default:
      return fail(`${field}.kind`, "must be null, number, text, or logic");
  }
};

/**
 * Maps a normalized input key to the exact spelling the definition declared.
 *
 * Keys match case-insensitively, but compilation has to emit one spelling:
 * `JOIN` qualifies every output column as `<inputKey>.<field>`, and WHERE,
 * GROUP, and SORT then address those columns by that exact string. A reference
 * authored as `orders` against an input declared `Orders` must therefore be
 * *stored* as `Orders`, or every pull fails on an unresolvable field.
 */
type DeclaredKeys = ReadonlyMap<string, string>;

const canonicalInput = (
  authored: string,
  field: string,
  declaredKeys: DeclaredKeys
): string => {
  const declared = declaredKeys.get(normalizeInputKey(authored));
  if (declared === undefined) {
    fail(field, `names no declared input: ${authored}`);
  }
  return declared as string;
};

const validateFieldRef = (
  value: unknown,
  field: string,
  declaredKeys: DeclaredKeys,
  options: StructuredAnalyticLimits
): AnalyticFieldRef => {
  if (typeof value !== "object" || value === null) fail(field, "must be an object");
  const raw = value as Record<string, unknown>;
  const authored = boundedText(raw.input, `${field}.input`, options.maxNameBytes);
  const input = canonicalInput(authored, `${field}.input`, declaredKeys);
  // Field names come from inside a table value, not the project name space, so
  // they are matched case-sensitively and Formula does not normalize them.
  //
  // The one exception is the synthesized column of a list or scalar input, which
  // *is* the input key and so matches the way keys match. Only a pull can tell
  // the two apart, because only a pull knows whether the input was tabular.
  const name = boundedText(raw.field, `${field}.field`, options.maxNameBytes);
  return { input, field: name };
};

const validatePlacement = (
  value: unknown,
  field: string,
  declaredKeys: DeclaredKeys,
  options: StructuredAnalyticLimits
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
  declaredKeys: DeclaredKeys,
  options: StructuredAnalyticLimits
): AnalyticFilter => {
  if (typeof value !== "object" || value === null) fail(field, "must be an object");
  const raw = value as Record<string, unknown>;
  const ref = validateFieldRef(raw.field, `${field}.field`, declaredKeys, options);
  // Checked against the full vocabulary first, so a typo is told about all ten
  // operators. Branching straight to the comparison arm would report only the
  // six it handles and claim `in` and `contains` are invalid.
  const operator = oneOf(raw.operator, ANALYTIC_FILTER_OPERATORS, `${field}.operator`);

  if (operator === "isNull" || operator === "isNotNull") {
    return { field: ref, operator };
  }
  if (operator === "in") {
    if (!Array.isArray(raw.values)) fail(`${field}.values`, "must be an array");
    const values = raw.values as unknown[];
    if (values.length === 0) fail(`${field}.values`, "must not be empty");
    if (values.length > options.maxFilterValues) {
      fail(`${field}.values`, `exceeds maxFilterValues (${options.maxFilterValues})`);
    }
    return {
      field: ref,
      operator: "in",
      values: values.map((entry, index) =>
        validateScalar(entry, `${field}.values[${index}]`, options))
    };
  }
  if (operator === "contains") {
    if (typeof raw.value !== "string") fail(`${field}.value`, "must be a string");
    if (Buffer.byteLength(raw.value as string, "utf8") > options.maxScalarBytes) {
      fail(`${field}.value`, `exceeds its ${options.maxScalarBytes}-byte limit`);
    }
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
    operator,
    value: validateScalar(raw.value, `${field}.value`, options)
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

/**
 * A definition reduced to counts and enums.
 *
 * Not a privacy device — it is the summary a reader wants before the detail:
 * "six inputs, one self-join, two measures, rendered as a bar". It rides along
 * in the same record as the definition itself.
 */
export interface AnalyticDefinitionShape {
  readonly inputCount: number;
  readonly joinCount: number;
  readonly rowPlacementCount: number;
  readonly columnPlacementCount: number;
  readonly aggregatedPlacementCount: number;
  readonly filterCount: number;
  readonly sortCount: number;
  readonly hasLimit: boolean;
  readonly displayKind: string;
  readonly selfJoinCount: number;
  readonly inputsWithRecordedEntryId: number;
}

export const describeDefinition = (
  definition: AnalyticDefinition
): AnalyticDefinitionShape => {
  const placements = [...definition.rows, ...definition.columns];
  const names = definition.inputs.map(input => normalizeInputKey(input.name));
  return {
    inputCount: definition.inputs.length,
    joinCount: definition.joins.length,
    rowPlacementCount: definition.rows.length,
    columnPlacementCount: definition.columns.length,
    aggregatedPlacementCount: placements.filter(p => p.aggregation !== "none").length,
    filterCount: definition.filters.length,
    sortCount: definition.sorts.length,
    hasLimit: definition.limit !== undefined,
    displayKind: definition.display.kind,
    selfJoinCount: names.length - new Set(names).size,
    inputsWithRecordedEntryId: definition.inputs.filter(input => input.entryId !== undefined).length
  };
};

export const validateAnalyticDefinition = (
  value: unknown,
  options: StructuredAnalyticLimits,
  logger?: Logger
): AnalyticDefinition => {
  const startedAt = performance.now();
  try {
    const definition = validateDefinitionInternal(value, options);
    // One record with everything in it: the summary counts and the definition
    // the compiler will turn into a Formula expression. Having it verbatim is
    // what lets a surprising pull be traced back to exactly what was saved.
    logger?.debug(
      "structured-analytic.definition.validated",
      {
        ...describeDefinition(definition),
        definition,
        durationMs: Math.round(performance.now() - startedAt)
      },
      { detail: "content" }
    );
    return definition;
  } catch (error) {
    // A rejection is an expected 400, not a fault — but it is the single most
    // useful line in the log, so it carries the rule that fired, the reason,
    // and the payload that broke it. Reproducing a client's bad request should
    // never require asking the client what they sent.
    logger?.warn(
      "structured-analytic.definition.rejected",
      {
        field: error instanceof AnalyticValidationError ? error.field : "unknown",
        errorName: error instanceof Error ? error.name : "UnknownError",
        reason:
          error instanceof AnalyticValidationError
            ? error.reason
            : error instanceof Error
              ? error.message
              : String(error),
        rejected: value,
        durationMs: Math.round(performance.now() - startedAt)
      },
      { detail: "content" }
    );
    throw error;
  }
};

const validateDefinitionInternal = (
  value: unknown,
  options: StructuredAnalyticLimits
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

  const declaredKeys = new Map<string, string>();
  const inputs = rawInputs.map((entry, index) => {
    const field = `inputs[${index}]`;
    if (typeof entry !== "object" || entry === null) fail(field, "must be an object");
    const rawInput = entry as Record<string, unknown>;
    const name = boundedText(rawInput.name, `${field}.name`, options.maxNameBytes);
    // `as` is a second label for the same source, not an alias in the dropped
    // sense: it exists so a self-join can tell its two sides apart.
    const asLabel =
      rawInput.as === undefined
        ? undefined
        : boundedText(rawInput.as, `${field}.as`, options.maxNameBytes);
    // Best-effort rename bookkeeping the runtime captures at save time. A
    // caller must not be able to steer it — a client-supplied `entryId` on a
    // name that does not currently resolve would retarget the input to an
    // unrelated entry on the first pull, and the self-heal would then rewrite
    // the stored name to match. Create and update overwrite this field; it is
    // accepted here only because rehydration from storage shares this path.
    const entryId =
      rawInput.entryId === undefined
        ? undefined
        : boundedText(rawInput.entryId, `${field}.entryId`, options.maxNameBytes);

    const declared = asLabel ?? name;
    const key = normalizeInputKey(declared);
    if (declaredKeys.has(key)) {
      fail(field, `duplicate input key: ${declared}`);
    }
    declaredKeys.set(key, declared);

    return {
      name,
      ...(asLabel !== undefined ? { as: asLabel } : {}),
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
    const authoredLeft = boundedText(rawJoin.left, `${field}.left`, options.maxNameBytes);
    const authoredRight = boundedText(rawJoin.right, `${field}.right`, options.maxNameBytes);

    // Stored as declared, not as authored — see canonicalInput.
    const left = canonicalInput(authoredLeft, `${field}.left`, declaredKeys);
    if (!introduced.has(normalizeInputKey(left))) {
      fail(`${field}.left`, `is not introduced yet: ${authoredLeft}`);
    }
    const right = inputKey(inputs[index + 1]);
    if (normalizeInputKey(authoredRight) !== normalizeInputKey(right)) {
      fail(`${field}.right`, `must introduce ${right}, got ${authoredRight}`);
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
    // Neither shelf alone is at fault, so neither is named.
    fail("placements", `Rows and Columns together exceed maxPlacements (${options.maxPlacements})`);
  }

  const rows = rawRows.map((entry, index) =>
    validatePlacement(entry, `rows[${index}]`, declaredKeys, options));
  const columns = rawColumns.map((entry, index) =>
    validatePlacement(entry, `columns[${index}]`, declaredKeys, options));

  // Ids are unique across both shelves, and the error points at the offender.
  // `field` is the only machine-readable part of a rejection — an editing
  // surface highlights it — so reporting "rows" for a duplicate in Columns
  // sends the client to the wrong pill.
  const placementIds = new Set<string>();
  for (const [shelf, placements] of [["rows", rows], ["columns", columns]] as const) {
    placements.forEach((placement, index) => {
      if (placementIds.has(placement.id)) {
        fail(`${shelf}[${index}].id`, `duplicates another placement id: ${placement.id}`);
      }
      placementIds.add(placement.id);
    });
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
  options: StructuredAnalyticLimits
): string => boundedText(value, "title", options.maxTitleBytes);

export const validateAnalyticDescription = (
  value: unknown,
  options: StructuredAnalyticLimits
): string | undefined =>
  value === undefined ? undefined : boundedText(value, "description", options.maxDescriptionBytes);

/**
 * Runs once at startup. The limits are logged in full because "why was that
 * rejected" and "which configuration is this process actually running" are the
 * same question often enough to be worth answering in advance.
 */
export const validateAnalyticLimits = (
  limits: StructuredAnalyticLimits,
  logger?: Logger
): void => {
  const record = limits as unknown as Record<string, unknown>;
  // Every key is asserted, not just the ones present. A limit built by omission
  // is silently permissive — both `bytes > undefined` and `length > undefined`
  // are `false` — so a missing key disables exactly the check it names.
  for (const key of STRUCTURED_ANALYTIC_LIMIT_KEYS) {
    const value = record[key];
    if (!Number.isSafeInteger(value) || (value as number) < 1) {
      logger?.error("structured-analytic.limits.rejected", { limit: key, value });
      throw new AnalyticConfigurationError(key, "must be a positive safe integer");
    }
  }
  logger?.info("structured-analytic.limits.resolved", { ...limits }, { detail: "content" });
};
