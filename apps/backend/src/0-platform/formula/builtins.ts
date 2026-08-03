// Built-in function registry for formula/v1.

import type { FormulaValue, FormulaFunction, FormulaTable, DisplayKind } from "./value.js";
import type { FormulaDiagnostic } from "./diagnostics.js";
import type { FormulaLimits } from "./limits.js";
import type { SourceSpan } from "./tokens.js";
import {
  NULL_VALUE, TRUE_VALUE, FALSE_VALUE,
  makeNumber, makeText, makeLogic, makeList, makeRecord, makeTable, EMPTY_TABLE,
  isDisplayKind,
  NumberValue, TextValue, LogicValue, ListValue, RecordValue, TableValue, FunctionValue
} from "./value.js";
import {
  ZERO, ONE, fromInt, fromDecimalString,
  add, sub, mul, div, mod, negate, absR, compare, eq, isZero, isInteger,
  floorR, ceilR, roundR, powR, CanonicalRational
} from "./rational.js";
import {
  typeError, wrongArity, divideByZero, invalidTable, limitExceeded, numericError,
  unknownField
} from "./diagnostics.js";

// Bumped from @1 when the relational builtins landed. Builtin function values
// carry this in their identity, so a bump re-digests them once; nothing
// persists a function value, so that is a cache refresh rather than a break.
export const BUILTIN_IMPLEMENTATION_VERSION = "formula/v1/builtins@2";

const BUILTIN_NAMES = new Set([
  "IF", "SUM", "PRODUCT", "MIN", "MAX", "AVG", "AVERAGE", "COUNT",
  "ABS", "MOD", "POWER", "POW", "ROUND", "FLOOR", "CEIL", "CEILING",
  "TABLE", "ROWS", "COLUMNS", "LAMBDA", "FUNCTION",
  "NOT", "AND", "OR", "TEXT", "NUMBER", "CONCAT",
  // Relational
  "ASTABLE", "JOIN", "WHERE", "GROUP", "AGGREGATE", "SORT", "LIMIT", "DISPLAY"
]);

export function isBuiltinName(name: string): boolean {
  return BUILTIN_NAMES.has(name.toUpperCase());
}

export interface BuiltinCallContext {
  readonly limits: FormulaLimits;
  readonly span?: SourceSpan;
  /** Lazy evaluation callback for IF branches. */
  evalArg(index: number): { value: FormulaValue; diagnostics: FormulaDiagnostic[] };
}

export type BuiltinResult = { value: FormulaValue; diagnostics: FormulaDiagnostic[] };

function ok(value: FormulaValue): BuiltinResult {
  return { value, diagnostics: [] };
}

function fail(diag: FormulaDiagnostic): BuiltinResult {
  return { value: NULL_VALUE, diagnostics: [diag] };
}

// ─── Numeric helpers ──────────────────────────────────────────────────────────

function asNumber(v: FormulaValue, span?: SourceSpan): CanonicalRational | FormulaDiagnostic {
  if (v.kind !== "number") return typeError(`Expected number, got ${v.kind}`, span);
  return v.value;
}

function flattenNumbers(values: FormulaValue[], span?: SourceSpan): CanonicalRational[] | FormulaDiagnostic {
  const nums: CanonicalRational[] = [];
  for (const v of values) {
    if (v.kind === "number") {
      nums.push(v.value);
    } else if (v.kind === "list" || v.kind === "table") {
      for (const row of v.table.rows) {
        for (const cell of row) {
          if (cell.kind === "number") nums.push(cell.value);
          else return typeError(`Expected number in aggregate, got ${cell.kind}`, span);
        }
      }
    } else {
      return typeError(`Expected number, got ${v.kind}`, span);
    }
  }
  return nums;
}

// ─── Relational helpers ───────────────────────────────────────────────────────
//
// The relational builtins take their options as a record, so that adding an
// option later is not a breaking change and call sites stay readable. Every
// optional key has a default defined here rather than at the call site.

type ScalarValue = NumberValue | TextValue | LogicValue | { readonly kind: "null" };

const AGGREGATE_FNS = ["sum", "count", "average", "min", "max"] as const;
const WHERE_OPS = [
  "equals", "notEquals", "greaterThan", "greaterThanOrEqual",
  "lessThan", "lessThanOrEqual", "in", "contains", "isNull", "isNotNull"
] as const;

/** Distinguishes a returned diagnostic from a returned value. */
function isDiagnostic(value: unknown): value is FormulaDiagnostic {
  return typeof value === "object" && value !== null && "code" in value && "message" in value;
}

function isScalar(v: FormulaValue): v is ScalarValue {
  return v.kind === "null" || v.kind === "number" || v.kind === "text" || v.kind === "logic";
}

/** list, record, and table are all table-backed; anything else is not. */
function requireTable(v: FormulaValue, label: string, span?: SourceSpan): FormulaTable | FormulaDiagnostic {
  if (v.kind === "list" || v.kind === "record" || v.kind === "table") return v.table;
  return typeError(`${label} requires a table, list, or record, got ${v.kind}`, span);
}

/**
 * Rendering intent survives operations that keep a table's shape — filtering,
 * ordering, and truncating a bar chart leave it a bar chart. It is dropped by
 * JOIN, GROUP, and AGGREGATE, which replace the columns outright, so the old
 * intent would describe data that no longer exists.
 */
function displayOf(v: FormulaValue): DisplayKind | undefined {
  return v.kind === "table" ? v.display : undefined;
}

const EMPTY_OPTIONS: RecordValue = { kind: "record", table: { fields: [], rows: [[]] } };

function requireOptions(v: FormulaValue | undefined, label: string, span?: SourceSpan): RecordValue | FormulaDiagnostic {
  if (v === undefined || v.kind === "null") return EMPTY_OPTIONS;
  if (v.kind !== "record") return typeError(`${label} options must be a record`, span);
  return v;
}

function optionOf(options: RecordValue, key: string): FormulaValue | undefined {
  const index = options.table.fields.indexOf(key);
  if (index < 0) return undefined;
  return options.table.rows[0]?.[index];
}

/** Unknown keys are rejected rather than ignored, so a typo is not silence. */
function rejectUnknownOptions(
  options: RecordValue,
  allowed: readonly string[],
  label: string,
  span?: SourceSpan
): FormulaDiagnostic | undefined {
  for (const field of options.table.fields) {
    if (!allowed.includes(field)) {
      return typeError(`${label} does not accept option '${field}'`, span);
    }
  }
  return undefined;
}

function optionText(
  options: RecordValue,
  key: string,
  label: string,
  span?: SourceSpan,
  fallback?: string
): string | FormulaDiagnostic {
  const value = optionOf(options, key);
  if (value === undefined || value.kind === "null") {
    if (fallback !== undefined) return fallback;
    return typeError(`${label} requires option '${key}'`, span);
  }
  if (value.kind !== "text") return typeError(`${label} option '${key}' must be text`, span);
  return value.value;
}

/** A list option's elements. Absent means an empty list, never an error. */
function optionList(
  options: RecordValue,
  key: string,
  label: string,
  span?: SourceSpan
): FormulaValue[] | FormulaDiagnostic {
  const value = optionOf(options, key);
  if (value === undefined || value.kind === "null") return [];
  if (value.kind !== "list") return typeError(`${label} option '${key}' must be a list`, span);
  return value.table.rows.map(row => row[0]);
}

/**
 * Canonical key for grouping and join probing. Rationals are already reduced,
 * so equal numbers always encode identically.
 */
function scalarKey(v: FormulaValue): string | undefined {
  switch (v.kind) {
    case "null": return "z:";
    case "number": return `n:${v.value.numerator}/${v.value.denominator}`;
    case "text": return `t:${v.value}`;
    case "logic": return `l:${v.value}`;
    default: return undefined;
  }
}

/**
 * Length-prefixed so a composite key is injective. Text cells can contain any
 * character, including whatever separator we might otherwise pick, so the
 * length is what makes ("a b", "c") and ("a", "b c") distinguishable.
 */
function appendKeyPart(composite: string, encoded: string): string {
  return `${composite}${encoded.length}:${encoded}`;
}

/** Cross-kind ordering rank, so a mixed column still sorts deterministically. */
const KIND_RANK: Record<string, number> = { number: 0, text: 1, logic: 2 };

function compareScalars(a: FormulaValue, b: FormulaValue): number {
  if (a.kind !== b.kind) return (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9);
  if (a.kind === "number" && b.kind === "number") return compare(a.value, b.value);
  if (a.kind === "text" && b.kind === "text") return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  if (a.kind === "logic" && b.kind === "logic") return (a.value ? 1 : 0) - (b.value ? 1 : 0);
  return 0;
}

/**
 * Filter equality, where null equals null. Join keys deliberately use different
 * semantics — see JOIN, where a null key matches nothing at all.
 */
function equalScalars(a: FormulaValue, b: FormulaValue): boolean {
  if (a.kind === "null" || b.kind === "null") return a.kind === "null" && b.kind === "null";
  if (a.kind !== b.kind) return false;
  if (a.kind === "number" && b.kind === "number") return eq(a.value, b.value);
  if (a.kind === "text" && b.kind === "text") return a.value === b.value;
  if (a.kind === "logic" && b.kind === "logic") return a.value === b.value;
  return false;
}

function checkTableLimits(
  fieldCount: number,
  rowCount: number,
  limits: FormulaLimits,
  span?: SourceSpan
): FormulaDiagnostic | undefined {
  if (rowCount > limits.maxRows) return limitExceeded("maxRows", rowCount, limits.maxRows, span);
  if (fieldCount > limits.maxFields) return limitExceeded("maxFields", fieldCount, limits.maxFields, span);
  const cells = rowCount * fieldCount;
  if (cells > limits.maxCells) return limitExceeded("maxCells", cells, limits.maxCells, span);
  return undefined;
}

type RowPredicate = (row: readonly FormulaValue[]) => boolean;

function compilePredicate(
  spec: FormulaValue,
  table: FormulaTable,
  span?: SourceSpan
): RowPredicate | FormulaDiagnostic {
  if (spec.kind !== "record") return typeError("WHERE predicates must be records", span);
  const unknown = rejectUnknownOptions(
    spec, ["field", "op", "value", "values", "caseSensitive"], "WHERE predicate", span
  );
  if (unknown) return unknown;

  const field = optionText(spec, "field", "WHERE predicate", span);
  if (isDiagnostic(field)) return field;
  const index = table.fields.indexOf(field);
  if (index < 0) return unknownField(field, span);

  const op = optionText(spec, "op", "WHERE predicate", span);
  if (isDiagnostic(op)) return op;
  if (!(WHERE_OPS as readonly string[]).includes(op)) {
    return typeError(`WHERE predicate op '${op}' is not supported`, span);
  }

  if (op === "isNull") return row => row[index].kind === "null";
  if (op === "isNotNull") return row => row[index].kind !== "null";

  if (op === "in") {
    const values = optionList(spec, "values", "WHERE predicate", span);
    if (isDiagnostic(values)) return values;
    if (values.length === 0) return typeError("WHERE 'in' requires a nonempty 'values' list", span);
    for (const value of values) {
      if (!isScalar(value)) return typeError("WHERE 'in' values must be scalars", span);
    }
    return row => values.some(value => equalScalars(row[index], value));
  }

  if (op === "contains") {
    const needle = optionOf(spec, "value");
    if (needle === undefined || needle.kind !== "text") {
      return typeError("WHERE 'contains' requires a text 'value'", span);
    }
    const flag = optionOf(spec, "caseSensitive");
    if (flag !== undefined && flag.kind !== "logic" && flag.kind !== "null") {
      return typeError("WHERE 'caseSensitive' must be a logic value", span);
    }
    const caseSensitive = flag !== undefined && flag.kind === "logic" ? flag.value : false;
    const target = caseSensitive ? needle.value : needle.value.toLowerCase();
    return row => {
      const cell = row[index];
      // Null and non-text never satisfy a substring test.
      if (cell.kind !== "text") return false;
      return (caseSensitive ? cell.value : cell.value.toLowerCase()).includes(target);
    };
  }

  const operand = optionOf(spec, "value");
  if (operand === undefined || !isScalar(operand)) {
    return typeError(`WHERE '${op}' requires a scalar 'value'`, span);
  }
  if (op === "equals") return row => equalScalars(row[index], operand);
  if (op === "notEquals") return row => !equalScalars(row[index], operand);

  // Ordering: number or text only, kind-strict, and null never passes.
  return row => {
    const cell = row[index];
    if (cell.kind === "null" || operand.kind === "null") return false;
    if (cell.kind !== operand.kind) return false;
    if (cell.kind !== "number" && cell.kind !== "text") return false;
    const ordering = compareScalars(cell, operand);
    switch (op) {
      case "greaterThan": return ordering > 0;
      case "greaterThanOrEqual": return ordering >= 0;
      case "lessThan": return ordering < 0;
      case "lessThanOrEqual": return ordering <= 0;
      default: return false;
    }
  };
}

function applyAggregate(
  fn: string,
  cells: readonly FormulaValue[],
  span?: SourceSpan
): FormulaValue | FormulaDiagnostic {
  const present = cells.filter(cell => cell.kind !== "null");
  if (fn === "count") return makeNumber(fromInt(BigInt(present.length)));
  // Every other aggregate is null over an empty group, which is how an empty
  // group stays distinguishable from a group that summed to zero.
  if (present.length === 0) return NULL_VALUE;

  if (fn === "sum" || fn === "average") {
    let total = ZERO;
    for (const cell of present) {
      if (cell.kind !== "number") {
        return typeError(`${fn} requires number values, got ${cell.kind}`, span);
      }
      total = add(total, cell.value);
    }
    return makeNumber(fn === "sum" ? total : div(total, fromInt(BigInt(present.length))));
  }

  const first = present[0];
  if (first.kind !== "number" && first.kind !== "text") {
    return typeError(`${fn} requires number or text values, got ${first.kind}`, span);
  }
  let best = first;
  for (const cell of present) {
    if (cell.kind !== first.kind) {
      return typeError(`${fn} cannot mix ${first.kind} and ${cell.kind}`, span);
    }
    const ordering = compareScalars(cell, best);
    if (fn === "min" ? ordering < 0 : ordering > 0) best = cell;
  }
  return best;
}

// ─── Built-in implementations ─────────────────────────────────────────────────

export function callBuiltin(
  name: string,
  args: FormulaValue[],
  ctx: BuiltinCallContext
): BuiltinResult {
  const upper = name.toUpperCase();
  const { span } = ctx;

  switch (upper) {
    case "IF": {
      if (args.length !== 3) return fail(wrongArity("IF", "3", args.length, span));
      const cond = args[0];
      if (cond.kind !== "logic") return fail(typeError("IF condition must be a logic value", span));
      // Already evaluated eagerly by the caller; lazy IF is handled in evaluator.ts
      return ok(cond.value ? args[1] : args[2]);
    }

    case "NOT": {
      if (args.length !== 1) return fail(wrongArity("NOT", "1", args.length, span));
      if (args[0].kind !== "logic") return fail(typeError("NOT requires a logic value", span));
      return ok(makeLogic(!args[0].value));
    }

    case "AND": {
      for (const a of args) {
        if (a.kind !== "logic") return fail(typeError("AND requires logic values", span));
        if (!a.value) return ok(FALSE_VALUE);
      }
      return ok(TRUE_VALUE);
    }

    case "OR": {
      for (const a of args) {
        if (a.kind !== "logic") return fail(typeError("OR requires logic values", span));
        if (a.value) return ok(TRUE_VALUE);
      }
      return ok(FALSE_VALUE);
    }

    case "SUM": {
      const nums = flattenNumbers(args, span);
      if (!Array.isArray(nums)) return fail(nums);
      if (nums.length === 0) return ok(makeNumber(ZERO));
      let total = ZERO;
      for (const n of nums) total = add(total, n);
      return ok(makeNumber(total));
    }

    case "PRODUCT": {
      const nums = flattenNumbers(args, span);
      if (!Array.isArray(nums)) return fail(nums);
      if (nums.length === 0) return ok(makeNumber(ONE));
      let total = ONE;
      for (const n of nums) total = mul(total, n);
      return ok(makeNumber(total));
    }

    case "MIN": {
      const nums = flattenNumbers(args, span);
      if (!Array.isArray(nums)) return fail(nums);
      if (nums.length === 0) return ok(NULL_VALUE);
      let min = nums[0];
      for (let i = 1; i < nums.length; i++) if (compare(nums[i], min) < 0) min = nums[i];
      return ok(makeNumber(min));
    }

    case "MAX": {
      const nums = flattenNumbers(args, span);
      if (!Array.isArray(nums)) return fail(nums);
      if (nums.length === 0) return ok(NULL_VALUE);
      let max = nums[0];
      for (let i = 1; i < nums.length; i++) if (compare(nums[i], max) > 0) max = nums[i];
      return ok(makeNumber(max));
    }

    case "AVG":
    case "AVERAGE": {
      const nums = flattenNumbers(args, span);
      if (!Array.isArray(nums)) return fail(nums);
      if (nums.length === 0) return ok(NULL_VALUE);
      let total = ZERO;
      for (const n of nums) total = add(total, n);
      return ok(makeNumber(div(total, fromInt(BigInt(nums.length)))));
    }

    case "COUNT": {
      if (args.length !== 1) return fail(wrongArity("COUNT", "1", args.length, span));
      const v = args[0];
      if (v.kind === "list" || v.kind === "table") return ok(makeNumber(fromInt(BigInt(v.table.rows.length))));
      if (v.kind === "record") return ok(makeNumber(fromInt(BigInt(v.table.fields.length))));
      return ok(makeNumber(ONE));
    }

    case "ABS": {
      if (args.length !== 1) return fail(wrongArity("ABS", "1", args.length, span));
      const n = asNumber(args[0], span);
      if (n instanceof Object && "code" in n) return fail(n as FormulaDiagnostic);
      return ok(makeNumber(absR(n as CanonicalRational)));
    }

    case "MOD": {
      if (args.length !== 2) return fail(wrongArity("MOD", "2", args.length, span));
      const a = asNumber(args[0], span);
      const b = asNumber(args[1], span);
      if ("code" in (a as object)) return fail(a as FormulaDiagnostic);
      if ("code" in (b as object)) return fail(b as FormulaDiagnostic);
      if (isZero(b as CanonicalRational)) return fail(divideByZero(span));
      return ok(makeNumber(mod(a as CanonicalRational, b as CanonicalRational)));
    }

    case "POWER":
    case "POW": {
      if (args.length !== 2) return fail(wrongArity(upper, "2", args.length, span));
      const base = asNumber(args[0], span);
      const exp = asNumber(args[1], span);
      if ("code" in (base as object)) return fail(base as FormulaDiagnostic);
      if ("code" in (exp as object)) return fail(exp as FormulaDiagnostic);
      try {
        const expR = exp as CanonicalRational;
        if (!isInteger(expR)) return fail(numericError("POWER exponent must be an integer", span));
        const absExp = expR.numerator < 0n ? -expR.numerator : expR.numerator;
        if (absExp > BigInt(ctx.limits.maxPowerMagnitude)) {
          return fail(limitExceeded("maxPowerMagnitude", Number(absExp), ctx.limits.maxPowerMagnitude, span));
        }
        return ok(makeNumber(powR(base as CanonicalRational, expR)));
      } catch (e) {
        return fail(numericError(String(e), span));
      }
    }

    case "ROUND": {
      if (args.length < 1 || args.length > 2) return fail(wrongArity("ROUND", "1 or 2", args.length, span));
      const n = asNumber(args[0], span);
      if ("code" in (n as object)) return fail(n as FormulaDiagnostic);
      let places = 0;
      if (args.length === 2) {
        const p = asNumber(args[1], span);
        if ("code" in (p as object)) return fail(p as FormulaDiagnostic);
        if (!isInteger(p as CanonicalRational)) return fail(numericError("ROUND places must be an integer", span));
        places = Number((p as CanonicalRational).numerator);
      }
      if (places > ctx.limits.maxRoundingPlaces) {
        return fail(limitExceeded("maxRoundingPlaces", places, ctx.limits.maxRoundingPlaces, span));
      }
      return ok(makeNumber(roundR(n as CanonicalRational, places)));
    }

    case "FLOOR": {
      if (args.length !== 1) return fail(wrongArity("FLOOR", "1", args.length, span));
      const n = asNumber(args[0], span);
      if ("code" in (n as object)) return fail(n as FormulaDiagnostic);
      return ok(makeNumber(floorR(n as CanonicalRational)));
    }

    case "CEIL":
    case "CEILING": {
      if (args.length !== 1) return fail(wrongArity(upper, "1", args.length, span));
      const n = asNumber(args[0], span);
      if ("code" in (n as object)) return fail(n as FormulaDiagnostic);
      return ok(makeNumber(ceilR(n as CanonicalRational)));
    }

    case "TABLE": {
      if (args.length === 0) return ok(EMPTY_TABLE);
      // TABLE(records...) or TABLE([records])
      let records: FormulaValue[];
      if (args.length === 1 && args[0].kind === "list") {
        records = args[0].table.rows.map(r => r[0]);
      } else {
        records = args;
      }
      if (records.length === 0) return ok(EMPTY_TABLE);
      const first = records[0];
      if (first.kind !== "record") return fail(invalidTable("TABLE requires record arguments", span));
      const fields = [...first.table.fields];
      const rows: FormulaValue[][] = [];
      for (const rec of records) {
        if (rec.kind !== "record") return fail(invalidTable("TABLE: all arguments must be records", span));
        if (rec.table.fields.length !== fields.length || !fields.every((f, i) => f === rec.table.fields[i])) {
          // Allow different order — realign to first record's order
          const missingFields = fields.filter(f => !rec.table.fields.includes(f));
          if (missingFields.length > 0) return fail(invalidTable(`TABLE: record missing fields: ${missingFields.join(", ")}`, span));
          const row = fields.map(f => {
            const idx = rec.table.fields.indexOf(f);
            return rec.table.rows[0][idx];
          });
          rows.push(row);
        } else {
          rows.push([...rec.table.rows[0]]);
        }
      }
      return ok(makeTable(fields, rows));
    }

    case "ROWS": {
      if (args.length !== 1) return fail(wrongArity("ROWS", "1", args.length, span));
      const v = args[0];
      if (v.kind === "list" || v.kind === "table") return ok(makeNumber(fromInt(BigInt(v.table.rows.length))));
      if (v.kind === "record") return ok(makeNumber(ONE)); // exactly one row
      return ok(makeNumber(ONE)); // scalar: 1x1
    }

    case "COLUMNS": {
      if (args.length !== 1) return fail(wrongArity("COLUMNS", "1", args.length, span));
      const v = args[0];
      if (v.kind === "list") return ok(makeNumber(ONE)); // always 1 field
      if (v.kind === "record" || v.kind === "table") return ok(makeNumber(fromInt(BigInt(v.table.fields.length))));
      return ok(makeNumber(ONE)); // scalar: 1x1
    }

    case "TEXT": {
      if (args.length !== 1) return fail(wrongArity("TEXT", "1", args.length, span));
      const v = args[0];
      switch (v.kind) {
        case "text": return ok(v);
        case "number": return ok(makeText(v.value.denominator === 1n ? v.value.numerator.toString() : `${v.value.numerator}/${v.value.denominator}`));
        case "logic": return ok(makeText(v.value ? "TRUE" : "FALSE"));
        case "null": return ok(makeText("NULL"));
        default: return fail(typeError(`Cannot convert ${v.kind} to text`, span));
      }
    }

    case "NUMBER": {
      if (args.length !== 1) return fail(wrongArity("NUMBER", "1", args.length, span));
      const v = args[0];
      if (v.kind === "number") return ok(v);
      if (v.kind === "text") {
        try { return ok(makeNumber(fromDecimalString(v.value))); }
        catch { return fail(typeError(`Cannot parse '${v.value}' as number`, span)); }
      }
      return fail(typeError(`Cannot convert ${v.kind} to number`, span));
    }

    case "CONCAT": {
      const parts: string[] = [];
      for (const a of args) {
        if (a.kind !== "text") return fail(typeError("CONCAT requires text values", span));
        parts.push(a.value);
      }
      return ok(makeText(parts.join("")));
    }

    // ─── Relational ───────────────────────────────────────────────────────────

    case "ASTABLE": {
      if (args.length !== 2) return fail(wrongArity("ASTABLE", "2", args.length, span));
      const nameArg = args[1];
      if (nameArg.kind !== "text" || nameArg.value.length === 0) {
        return fail(typeError("ASTABLE requires a non-empty text name", span));
      }
      const name = nameArg.value;
      const value = args[0];
      switch (value.kind) {
        case "table":
          return ok(value);
        case "record":
          // Already one row with its own field names.
          return ok(makeTable([...value.table.fields], value.table.rows.map(row => [...row])));
        case "list":
          // Formula names a list's only column "value"; the caller's name is better.
          return ok(makeTable([name], value.table.rows.map(row => [row[0]])));
        case "function":
          return fail(typeError("ASTABLE cannot convert a function value", span));
        default:
          return ok(makeTable([name], [[value]]));
      }
    }

    case "JOIN": {
      if (args.length < 2 || args.length > 3) {
        return fail(wrongArity("JOIN", "2 or 3", args.length, span));
      }
      const left = requireTable(args[0], "JOIN left", span);
      if (isDiagnostic(left)) return fail(left);
      const right = requireTable(args[1], "JOIN right", span);
      if (isDiagnostic(right)) return fail(right);
      const options = requireOptions(args[2], "JOIN", span);
      if (isDiagnostic(options)) return fail(options);
      const unknown = rejectUnknownOptions(options, ["kind", "on", "leftAs", "rightAs"], "JOIN", span);
      if (unknown) return fail(unknown);

      const joinKind = optionText(options, "kind", "JOIN", span, "inner");
      if (isDiagnostic(joinKind)) return fail(joinKind);
      if (joinKind !== "inner" && joinKind !== "left") {
        return fail(typeError("JOIN option 'kind' must be \"inner\" or \"left\"", span));
      }
      const leftAs = optionText(options, "leftAs", "JOIN", span, "");
      if (isDiagnostic(leftAs)) return fail(leftAs);
      const rightAs = optionText(options, "rightAs", "JOIN", span, "");
      if (isDiagnostic(rightAs)) return fail(rightAs);

      const onEntries = optionList(options, "on", "JOIN", span);
      if (isDiagnostic(onEntries)) return fail(onEntries);
      if (onEntries.length === 0) return fail(typeError("JOIN requires a nonempty 'on' list", span));
      if (onEntries.length > ctx.limits.maxFields) {
        return fail(limitExceeded("maxFields", onEntries.length, ctx.limits.maxFields, span));
      }

      const keyPairs: { left: number; right: number }[] = [];
      for (const entry of onEntries) {
        if (entry.kind !== "record") return fail(typeError("JOIN 'on' entries must be records", span));
        const unknownKey = rejectUnknownOptions(entry, ["left", "right"], "JOIN 'on' entry", span);
        if (unknownKey) return fail(unknownKey);
        const leftField = optionText(entry, "left", "JOIN 'on' entry", span);
        if (isDiagnostic(leftField)) return fail(leftField);
        const rightField = optionText(entry, "right", "JOIN 'on' entry", span);
        if (isDiagnostic(rightField)) return fail(rightField);
        const leftIndex = left.fields.indexOf(leftField);
        if (leftIndex < 0) return fail(unknownField(leftField, span));
        const rightIndex = right.fields.indexOf(rightField);
        if (rightIndex < 0) return fail(unknownField(rightField, span));
        keyPairs.push({ left: leftIndex, right: rightIndex });
      }

      const qualify = (prefix: string, field: string): string => prefix === "" ? field : `${prefix}.${field}`;
      const fields = [
        ...left.fields.map(field => qualify(leftAs, field)),
        ...right.fields.map(field => qualify(rightAs, field))
      ];
      const duplicate = fields.find((field, index) => fields.indexOf(field) !== index);
      if (duplicate !== undefined) {
        return fail(invalidTable(
          `JOIN produces duplicate field '${duplicate}'; supply 'leftAs' or 'rightAs'`, span
        ));
      }

      // Index the right side. A null key never matches — not even another null —
      // so null-keyed rows are simply absent from the probe.
      const probe = new Map<string, FormulaValue[][]>();
      for (const row of right.rows) {
        let composite = "";
        let nullKey = false;
        for (const pair of keyPairs) {
          const cell = row[pair.right];
          if (cell.kind === "null") { nullKey = true; break; }
          const encoded = scalarKey(cell);
          if (encoded === undefined) return fail(typeError("JOIN keys must be scalar values", span));
          composite = appendKeyPart(composite, encoded);
        }
        if (nullKey) continue;
        const bucket = probe.get(composite);
        if (bucket) bucket.push([...row]);
        else probe.set(composite, [[...row]]);
      }

      const rightNulls: FormulaValue[] = right.fields.map(() => NULL_VALUE);
      const joined: FormulaValue[][] = [];
      for (const row of left.rows) {
        let composite = "";
        let nullKey = false;
        for (const pair of keyPairs) {
          const cell = row[pair.left];
          if (cell.kind === "null") { nullKey = true; break; }
          const encoded = scalarKey(cell);
          if (encoded === undefined) return fail(typeError("JOIN keys must be scalar values", span));
          composite = appendKeyPart(composite, encoded);
        }
        const matches = nullKey ? undefined : probe.get(composite);
        if (!matches || matches.length === 0) {
          if (joinKind === "left") joined.push([...row, ...rightNulls]);
          continue;
        }
        for (const match of matches) joined.push([...row, ...match]);
        // A join multiplies rows, so the intermediate is bounded as it grows
        // rather than after the whole product has been materialised.
        const growth = checkTableLimits(fields.length, joined.length, ctx.limits, span);
        if (growth) return fail(growth);
      }

      const limit = checkTableLimits(fields.length, joined.length, ctx.limits, span);
      if (limit) return fail(limit);
      return ok(makeTable(fields, joined));
    }

    case "WHERE": {
      if (args.length < 1 || args.length > 2) {
        return fail(wrongArity("WHERE", "1 or 2", args.length, span));
      }
      const table = requireTable(args[0], "WHERE", span);
      if (isDiagnostic(table)) return fail(table);
      const options = requireOptions(args[1], "WHERE", span);
      if (isDiagnostic(options)) return fail(options);
      const unknown = rejectUnknownOptions(options, ["all", "any"], "WHERE", span);
      if (unknown) return fail(unknown);

      const allSpecs = optionList(options, "all", "WHERE", span);
      if (isDiagnostic(allSpecs)) return fail(allSpecs);
      const anySpecs = optionList(options, "any", "WHERE", span);
      if (isDiagnostic(anySpecs)) return fail(anySpecs);

      const all: RowPredicate[] = [];
      for (const spec of allSpecs) {
        const predicate = compilePredicate(spec, table, span);
        if (isDiagnostic(predicate)) return fail(predicate);
        all.push(predicate);
      }
      const any: RowPredicate[] = [];
      for (const spec of anySpecs) {
        const predicate = compilePredicate(spec, table, span);
        if (isDiagnostic(predicate)) return fail(predicate);
        any.push(predicate);
      }

      const kept = table.rows
        .filter(row => all.every(p => p(row)) && (any.length === 0 || any.some(p => p(row))))
        .map(row => [...row]);
      return ok(makeTable([...table.fields], kept, displayOf(args[0])));
    }

    case "GROUP":
    case "AGGREGATE": {
      const grouping = upper === "GROUP";
      if (args.length < 1 || args.length > 2) {
        return fail(wrongArity(upper, "1 or 2", args.length, span));
      }
      const table = requireTable(args[0], upper, span);
      if (isDiagnostic(table)) return fail(table);
      const options = requireOptions(args[1], upper, span);
      if (isDiagnostic(options)) return fail(options);
      const unknown = rejectUnknownOptions(
        options, grouping ? ["keys", "aggregates"] : ["aggregates"], upper, span
      );
      if (unknown) return fail(unknown);

      const keyIndexes: number[] = [];
      const keyNames: string[] = [];
      if (grouping) {
        const keys = optionList(options, "keys", upper, span);
        if (isDiagnostic(keys)) return fail(keys);
        for (const key of keys) {
          // A key is a bare field name, or {field, as} when the output column
          // should be named something other than its source — which is what
          // lets a caller label a grouping column without a rename pass.
          let field: string;
          let alias: string;
          if (key.kind === "text") {
            field = key.value;
            alias = key.value;
          } else if (key.kind === "record") {
            const unknownKey = rejectUnknownOptions(key, ["field", "as"], "GROUP key", span);
            if (unknownKey) return fail(unknownKey);
            const named = optionText(key, "field", "GROUP key", span);
            if (isDiagnostic(named)) return fail(named);
            const labelled = optionText(key, "as", "GROUP key", span, named);
            if (isDiagnostic(labelled)) return fail(labelled);
            field = named;
            alias = labelled;
          } else {
            return fail(typeError("GROUP 'keys' entries must be a field name or a record", span));
          }
          const index = table.fields.indexOf(field);
          if (index < 0) return fail(unknownField(field, span));
          keyIndexes.push(index);
          keyNames.push(alias);
        }
      }

      const aggregateSpecs = optionList(options, "aggregates", upper, span);
      if (isDiagnostic(aggregateSpecs)) return fail(aggregateSpecs);
      if (!grouping && aggregateSpecs.length === 0) {
        return fail(typeError("AGGREGATE requires a nonempty 'aggregates' list", span));
      }

      const aggregates: { as: string; index: number; fn: string }[] = [];
      for (const spec of aggregateSpecs) {
        if (spec.kind !== "record") {
          return fail(typeError(`${upper} 'aggregates' entries must be records`, span));
        }
        const unknownAgg = rejectUnknownOptions(spec, ["as", "field", "fn"], `${upper} aggregate`, span);
        if (unknownAgg) return fail(unknownAgg);
        const alias = optionText(spec, "as", `${upper} aggregate`, span);
        if (isDiagnostic(alias)) return fail(alias);
        const field = optionText(spec, "field", `${upper} aggregate`, span);
        if (isDiagnostic(field)) return fail(field);
        const fn = optionText(spec, "fn", `${upper} aggregate`, span);
        if (isDiagnostic(fn)) return fail(fn);
        if (!(AGGREGATE_FNS as readonly string[]).includes(fn)) {
          return fail(typeError(`${upper} aggregate fn '${fn}' is not supported`, span));
        }
        const index = table.fields.indexOf(field);
        if (index < 0) return fail(unknownField(field, span));
        aggregates.push({ as: alias, index, fn });
      }

      const outFields = [...keyNames, ...aggregates.map(a => a.as)];
      const duplicate = outFields.find((field, index) => outFields.indexOf(field) !== index);
      if (duplicate !== undefined) {
        return fail(invalidTable(`${upper} produces duplicate field '${duplicate}'`, span));
      }

      // Groups keep first-appearance order. Unlike a join key, null groups with
      // null here — "no region" is a bucket, not an absence of one.
      const order: string[] = [];
      const groups = new Map<string, { key: FormulaValue[]; rows: (readonly FormulaValue[])[] }>();
      for (const row of table.rows) {
        let composite = "";
        for (const index of keyIndexes) {
          const encoded = scalarKey(row[index]);
          if (encoded === undefined) return fail(typeError(`${upper} keys must be scalar values`, span));
          composite = appendKeyPart(composite, encoded);
        }
        let group = groups.get(composite);
        if (!group) {
          group = { key: keyIndexes.map(index => row[index]), rows: [] };
          groups.set(composite, group);
          order.push(composite);
        }
        group.rows.push(row);
      }
      // A rollup of nothing is still one row; a grouping of nothing is no rows.
      if (!grouping && groups.size === 0) {
        groups.set("", { key: [], rows: [] });
        order.push("");
      }

      const summarised: FormulaValue[][] = [];
      for (const composite of order) {
        const group = groups.get(composite);
        if (!group) continue;
        const out: FormulaValue[] = [...group.key];
        for (const aggregate of aggregates) {
          const result = applyAggregate(aggregate.fn, group.rows.map(row => row[aggregate.index]), span);
          if (isDiagnostic(result)) return fail(result);
          out.push(result);
        }
        summarised.push(out);
      }

      const limit = checkTableLimits(outFields.length, summarised.length, ctx.limits, span);
      if (limit) return fail(limit);
      return ok(makeTable(outFields, summarised));
    }

    case "SORT": {
      if (args.length !== 2) return fail(wrongArity("SORT", "2", args.length, span));
      const table = requireTable(args[0], "SORT", span);
      if (isDiagnostic(table)) return fail(table);
      const sortArg = args[1];
      if (sortArg.kind !== "list") return fail(typeError("SORT requires a list of sort records", span));

      const specs: { index: number; direction: 1 | -1 }[] = [];
      for (const row of sortArg.table.rows) {
        const spec = row[0];
        if (spec.kind !== "record") return fail(typeError("SORT entries must be records", span));
        const unknownSort = rejectUnknownOptions(spec, ["field", "direction"], "SORT entry", span);
        if (unknownSort) return fail(unknownSort);
        const field = optionText(spec, "field", "SORT entry", span);
        if (isDiagnostic(field)) return fail(field);
        const index = table.fields.indexOf(field);
        if (index < 0) return fail(unknownField(field, span));
        const direction = optionText(spec, "direction", "SORT entry", span, "asc");
        if (isDiagnostic(direction)) return fail(direction);
        if (direction !== "asc" && direction !== "desc") {
          return fail(typeError("SORT 'direction' must be \"asc\" or \"desc\"", span));
        }
        specs.push({ index, direction: direction === "asc" ? 1 : -1 });
      }

      // A nested value has no ordering, and comparing it silently as equal would
      // make the whole sort a no-op that looks like it worked.
      for (const spec of specs) {
        for (const row of table.rows) {
          if (!isScalar(row[spec.index])) {
            return fail(typeError(`SORT requires scalar values, got ${row[spec.index].kind}`, span));
          }
        }
      }

      const decorated = table.rows.map((row, position) => ({ row, position }));
      decorated.sort((a, b) => {
        for (const spec of specs) {
          const left = a.row[spec.index];
          const right = b.row[spec.index];
          const leftNull = left.kind === "null";
          const rightNull = right.kind === "null";
          // Null sorts last in both directions, so reversing a sort never
          // promotes missing data to the top.
          if (leftNull || rightNull) {
            if (leftNull && rightNull) continue;
            return leftNull ? 1 : -1;
          }
          const ordering = compareScalars(left, right);
          if (ordering !== 0) return ordering * spec.direction;
        }
        return a.position - b.position;
      });
      return ok(makeTable([...table.fields], decorated.map(entry => [...entry.row]), displayOf(args[0])));
    }

    case "LIMIT": {
      if (args.length !== 2) return fail(wrongArity("LIMIT", "2", args.length, span));
      const table = requireTable(args[0], "LIMIT", span);
      if (isDiagnostic(table)) return fail(table);
      const count = args[1];
      if (count.kind !== "number") return fail(typeError("LIMIT requires a number", span));
      if (count.value.denominator !== 1n || count.value.numerator < 1n) {
        return fail(typeError("LIMIT requires a positive integer", span));
      }
      const take = Number(count.value.numerator);
      return ok(makeTable([...table.fields], table.rows.slice(0, take).map(row => [...row]), displayOf(args[0])));
    }

    case "DISPLAY": {
      if (args.length !== 2) return fail(wrongArity("DISPLAY", "2", args.length, span));
      const table = requireTable(args[0], "DISPLAY", span);
      if (isDiagnostic(table)) return fail(table);
      const kind = args[1];
      if (kind.kind !== "text") return fail(typeError("DISPLAY kind must be text", span));
      if (!isDisplayKind(kind.value)) {
        return fail(typeError(`DISPLAY kind '${kind.value}' is not supported`, span));
      }
      // A display IS its table — the annotation rides along, nothing is wrapped.
      return ok(makeTable([...table.fields], table.rows.map(row => [...row]), kind.value));
    }

    case "LAMBDA":
    case "FUNCTION":
      // LAMBDA is handled at parse time (LambdaNode) — if it reaches here it's already a function value
      return fail(wrongArity("LAMBDA", "2+", args.length, span));

    default:
      return fail({ code: "unknown_function", message: `Unknown function: ${name}` });
  }
}
