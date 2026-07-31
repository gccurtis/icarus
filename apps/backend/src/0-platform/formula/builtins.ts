// Built-in function registry for formula/v1.

import type { FormulaValue, FormulaFunction } from "./value.js";
import type { FormulaDiagnostic } from "./diagnostics.js";
import type { FormulaLimits } from "./limits.js";
import type { SourceSpan } from "./tokens.js";
import {
  NULL_VALUE, TRUE_VALUE, FALSE_VALUE,
  makeNumber, makeText, makeLogic, makeList, makeRecord, makeTable, EMPTY_TABLE,
  NumberValue, TextValue, LogicValue, ListValue, RecordValue, TableValue, FunctionValue
} from "./value.js";
import {
  ZERO, ONE, fromInt, fromDecimalString,
  add, sub, mul, div, mod, negate, absR, compare, eq, isZero, isInteger,
  floorR, ceilR, roundR, powR, CanonicalRational
} from "./rational.js";
import {
  typeError, wrongArity, divideByZero, invalidTable, limitExceeded, numericError
} from "./diagnostics.js";

export const BUILTIN_IMPLEMENTATION_VERSION = "formula/v1/builtins@1";

const BUILTIN_NAMES = new Set([
  "IF", "SUM", "PRODUCT", "MIN", "MAX", "AVG", "AVERAGE", "COUNT",
  "ABS", "MOD", "POWER", "POW", "ROUND", "FLOOR", "CEIL", "CEILING",
  "TABLE", "ROWS", "COLUMNS", "LAMBDA", "FUNCTION",
  "NOT", "AND", "OR", "TEXT", "NUMBER", "CONCAT"
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

    case "LAMBDA":
    case "FUNCTION":
      // LAMBDA is handled at parse time (LambdaNode) — if it reaches here it's already a function value
      return fail(wrongArity("LAMBDA", "2+", args.length, span));

    default:
      return fail({ code: "unknown_function", message: `Unknown function: ${name}` });
  }
}
