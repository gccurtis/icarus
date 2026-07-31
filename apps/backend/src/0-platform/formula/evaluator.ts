// Evaluator — walks a bound AST and produces a FormulaValue.
// Evaluation is pure: same bound AST + snapshot → same result.

import type { FormulaNode, FormulaConditionNode, BoundFormulaReference } from "./ast.js";
import type { FormulaValue, FormulaFunction, LambdaFunction, FormulaTable } from "./value.js";
import type { FormulaResolverSnapshot } from "./resolver.js";
import type { FormulaDiagnostic } from "./diagnostics.js";
import type { FormulaLimits } from "./limits.js";
import type { ObservedDependency } from "./dependencies.js";
import {
  NULL_VALUE, TRUE_VALUE, FALSE_VALUE,
  makeNumber, makeText, makeLogic, makeList, makeRecord, makeTable, EMPTY_TABLE,
  NullValue, NumberValue, TextValue, LogicValue, ListValue, RecordValue, TableValue, FunctionValue
} from "./value.js";
import {
  ZERO, ONE, fromInt, fromDecimalString,
  add, sub, mul, div, mod, negate, absR, compare, eq, isZero, powR,
  CanonicalRational
} from "./rational.js";
import {
  typeError, divideByZero, unknownIdentifier, limitExceeded, invalidIndex,
  indexOutOfRange, unknownField, invalidTable, cardinalityError, numericError
} from "./diagnostics.js";
import { callBuiltin, BUILTIN_IMPLEMENTATION_VERSION, isBuiltinName } from "./builtins.js";
import { normalizeKey } from "./resolver.js";
import { createHash } from "node:crypto";

export const EVALUATOR_VERSION = "formula/v1/evaluator@1";

export interface EvalContext {
  readonly snapshot: FormulaResolverSnapshot;
  readonly limits: FormulaLimits;
  steps: number;
  callDepth: number;
  readonly observed: Map<string, ObservedDependency>;
  /** Local variable env — lambda params and set-row fields. */
  env: Map<string, FormulaValue>;
}

export interface EvalResult {
  readonly value: FormulaValue;
  readonly diagnostics: FormulaDiagnostic[];
}

function ok(value: FormulaValue): EvalResult {
  return { value, diagnostics: [] };
}

function fail(diag: FormulaDiagnostic): EvalResult {
  return { value: NULL_VALUE, diagnostics: [diag] };
}

function step(ctx: EvalContext, span: import("./tokens.js").SourceSpan | undefined): FormulaDiagnostic | null {
  ctx.steps++;
  if (ctx.steps > ctx.limits.maxSteps) {
    return limitExceeded("maxSteps", ctx.steps, ctx.limits.maxSteps, span);
  }
  return null;
}

// ─── Main evaluator ───────────────────────────────────────────────────────────

export function evalNode(node: FormulaNode, ctx: EvalContext): EvalResult {
  const s = step(ctx, node.span);
  if (s) return fail(s);

  switch (node.type) {
    case "null-literal": return ok(NULL_VALUE);

    case "logic-literal": return ok(makeLogic(node.value));

    case "text-literal": return ok(makeText(node.value));

    case "number-literal": {
      try {
        return ok(makeNumber(fromDecimalString(node.raw)));
      } catch (e) {
        return fail(numericError(`Invalid number literal: ${node.raw}`, node.span));
      }
    }

    case "name": return evalName(node, ctx);

    case "list-literal": return evalList(node, ctx);

    case "record-literal": return evalRecord(node, ctx);

    case "unary": return evalUnary(node, ctx);

    case "binary": return evalBinary(node, ctx);

    case "call": return evalCall(node, ctx);

    case "lambda": return evalLambda(node, ctx);

    case "field-access": return evalFieldAccess(node, ctx);

    case "index": return evalIndex(node, ctx);

    case "slice": return evalSlice(node, ctx);

    case "set-operation": return evalSetOperation(node, ctx);

    case "cardinality-promotion": return evalCardinality(node, ctx);
  }
}

function evalName(node: import("./ast.js").NameNode, ctx: EvalContext): EvalResult {
  // 1. Local env (lambda params, set-row fields)
  const key = normalizeKey(node.name);
  const local = ctx.env.get(key);
  if (local !== undefined) return ok(local);

  // 2. Bound reference
  if (node.binding) {
    const binding = ctx.snapshot.bindings.get(node.binding.bindingId) ??
      [...ctx.snapshot.bindings.values()].find(b => b.reference.bindingId === node.binding!.bindingId);
    if (binding) {
      ctx.observed.set(node.binding.bindingId, {
        reference: node.binding,
        ownerRevision: binding.ownerRevision,
        valueDigest: binding.valueDigest,
        access: { kind: "value" }
      });
      return ok(binding.value);
    }
    return fail({ code: "stale_binding", message: `Binding ${node.binding.bindingId} not found`, span: node.span });
  }

  // 3. Snapshot by display name
  const snapBinding = ctx.snapshot.bindings.get(key);
  if (snapBinding) {
    ctx.observed.set(snapBinding.reference.bindingId, {
      reference: snapBinding.reference,
      ownerRevision: snapBinding.ownerRevision,
      valueDigest: snapBinding.valueDigest,
      access: { kind: "value" }
    });
    return ok(snapBinding.value);
  }

  return fail(unknownIdentifier(node.name, node.span));
}

function evalList(node: import("./ast.js").ListLiteralNode, ctx: EvalContext): EvalResult {
  const elements: FormulaValue[] = [];
  for (const e of node.elements) {
    const r = evalNode(e, ctx);
    if (r.diagnostics.length > 0) return r;
    elements.push(r.value);
  }
  if (elements.length > ctx.limits.maxRows) {
    return fail(limitExceeded("maxRows", elements.length, ctx.limits.maxRows, node.span));
  }
  return ok(makeList(elements));
}

function evalRecord(node: import("./ast.js").RecordLiteralNode, ctx: EvalContext): EvalResult {
  const fields: string[] = [];
  const values: FormulaValue[] = [];
  for (const f of node.fields) {
    const r = evalNode(f.value, ctx);
    if (r.diagnostics.length > 0) return r;
    fields.push(f.key);
    values.push(r.value);
  }
  if (fields.length > ctx.limits.maxFields) {
    return fail(limitExceeded("maxFields", fields.length, ctx.limits.maxFields, node.span));
  }
  return ok(makeRecord(fields, values));
}

function evalUnary(node: import("./ast.js").UnaryNode, ctx: EvalContext): EvalResult {
  const r = evalNode(node.operand, ctx);
  if (r.diagnostics.length > 0) return r;
  const v = r.value;
  switch (node.operator) {
    case "-":
      if (v.kind !== "number") return fail(typeError(`Unary '-' requires number, got ${v.kind}`, node.span));
      return ok(makeNumber(negate(v.value)));
    case "+":
      if (v.kind !== "number") return fail(typeError(`Unary '+' requires number, got ${v.kind}`, node.span));
      return ok(v);
    case "!":
      if (v.kind !== "logic") return fail(typeError(`Unary '!' requires logic, got ${v.kind}`, node.span));
      return ok(makeLogic(!v.value));
  }
}

function evalBinary(node: import("./ast.js").BinaryNode, ctx: EvalContext): EvalResult {
  // Short-circuit for && and ||
  if (node.operator === "&&") {
    const left = evalNode(node.left, ctx);
    if (left.diagnostics.length > 0) return left;
    if (left.value.kind !== "logic") return fail(typeError("'&&' requires logic values", node.span));
    if (!left.value.value) return ok(FALSE_VALUE);
    const right = evalNode(node.right, ctx);
    if (right.diagnostics.length > 0) return right;
    if (right.value.kind !== "logic") return fail(typeError("'&&' requires logic values", node.span));
    return ok(makeLogic(right.value.value));
  }
  if (node.operator === "||") {
    const left = evalNode(node.left, ctx);
    if (left.diagnostics.length > 0) return left;
    if (left.value.kind !== "logic") return fail(typeError("'||' requires logic values", node.span));
    if (left.value.value) return ok(TRUE_VALUE);
    const right = evalNode(node.right, ctx);
    if (right.diagnostics.length > 0) return right;
    if (right.value.kind !== "logic") return fail(typeError("'||' requires logic values", node.span));
    return ok(makeLogic(right.value.value));
  }

  const left = evalNode(node.left, ctx);
  if (left.diagnostics.length > 0) return left;
  const right = evalNode(node.right, ctx);
  if (right.diagnostics.length > 0) return right;
  const lv = left.value;
  const rv = right.value;

  switch (node.operator) {
    case "+": {
      if (lv.kind === "number" && rv.kind === "number") return ok(makeNumber(add(lv.value, rv.value)));
      if (lv.kind === "text" && rv.kind === "text") return ok(makeText(lv.value + rv.value));
      return fail(typeError(`'+' requires two numbers or two texts`, node.span));
    }
    case "-": {
      if (lv.kind !== "number" || rv.kind !== "number") return fail(typeError(`'-' requires numbers`, node.span));
      return ok(makeNumber(sub(lv.value, rv.value)));
    }
    case "*": {
      if (lv.kind !== "number" || rv.kind !== "number") return fail(typeError(`'*' requires numbers`, node.span));
      return ok(makeNumber(mul(lv.value, rv.value)));
    }
    case "/": {
      if (lv.kind !== "number" || rv.kind !== "number") return fail(typeError(`'/' requires numbers`, node.span));
      if (isZero(rv.value)) return fail(divideByZero(node.span));
      return ok(makeNumber(div(lv.value, rv.value)));
    }
    case "%": {
      if (lv.kind !== "number" || rv.kind !== "number") return fail(typeError(`'%' requires numbers`, node.span));
      if (isZero(rv.value)) return fail(divideByZero(node.span));
      return ok(makeNumber(mod(lv.value, rv.value)));
    }
    case "^": {
      if (lv.kind !== "number" || rv.kind !== "number") return fail(typeError(`'^' requires numbers`, node.span));
      const absExp = rv.value.numerator < 0n ? -rv.value.numerator : rv.value.numerator;
      if (absExp > BigInt(ctx.limits.maxPowerMagnitude)) {
        return fail(limitExceeded("maxPowerMagnitude", Number(absExp), ctx.limits.maxPowerMagnitude, node.span));
      }
      try { return ok(makeNumber(powR(lv.value, rv.value))); }
      catch (e) { return fail(numericError(String(e), node.span)); }
    }
    case "=": return ok(makeLogic(formulaEqual(lv, rv)));
    case "!=": return ok(makeLogic(!formulaEqual(lv, rv)));
    case "<": return evalComparison(lv, rv, -1, false, node);
    case "<=": return evalComparison(lv, rv, -1, true, node);
    case ">": return evalComparison(lv, rv, 1, false, node);
    case ">=": return evalComparison(lv, rv, 1, true, node);
  }
}

function evalComparison(
  lv: FormulaValue, rv: FormulaValue,
  dir: 1 | -1, orEqual: boolean,
  node: import("./ast.js").BinaryNode
): EvalResult {
  if (lv.kind === "number" && rv.kind === "number") {
    const c = compare(lv.value, rv.value);
    return ok(makeLogic(orEqual ? c * dir >= 0 : c * dir > 0));
  }
  if (lv.kind === "text" && rv.kind === "text") {
    const c = lv.value < rv.value ? -1 : lv.value > rv.value ? 1 : 0;
    return ok(makeLogic(orEqual ? c * dir >= 0 : c * dir > 0));
  }
  return fail(typeError(`Comparison requires matching number or text kinds`, node.span));
}

function formulaEqual(a: FormulaValue, b: FormulaValue): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "null": return true;
    case "number": return eq(a.value, (b as NumberValue).value);
    case "text": return a.value === (b as TextValue).value;
    case "logic": return a.value === (b as LogicValue).value;
    case "list":
    case "record":
    case "table": return tableEqual(a.table, (b as ListValue | RecordValue | TableValue).table);
    case "function": return fnEqual(a.fn, (b as FunctionValue).fn);
  }
}

function tableEqual(a: FormulaTable, b: FormulaTable): boolean {
  if (a.fields.length !== b.fields.length || a.rows.length !== b.rows.length) return false;
  for (let i = 0; i < a.fields.length; i++) if (a.fields[i] !== b.fields[i]) return false;
  for (let r = 0; r < a.rows.length; r++) {
    for (let c = 0; c < a.fields.length; c++) {
      if (!formulaEqual(a.rows[r][c], b.rows[r][c])) return false;
    }
  }
  return true;
}

function fnEqual(a: FormulaFunction, b: FormulaFunction): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "builtin" && b.kind === "builtin") {
    return a.name === b.name && a.implementationVersion === b.implementationVersion;
  }
  if (a.kind === "lambda" && b.kind === "lambda") {
    return a.identityDigest === b.identityDigest;
  }
  return false;
}

function evalCall(node: import("./ast.js").CallNode, ctx: EvalContext): EvalResult {
  // Special case: IF is lazy
  if (node.callee.type === "name" && node.callee.name.toUpperCase() === "IF") {
    if (node.args.length !== 3) return fail({ code: "wrong_arity", message: "IF requires 3 arguments", span: node.span });
    const condR = evalNode(node.args[0], ctx);
    if (condR.diagnostics.length > 0) return condR;
    if (condR.value.kind !== "logic") return fail(typeError("IF condition must be a logic value", node.span));
    return evalNode(condR.value.value ? node.args[1] : node.args[2], ctx);
  }

  // Builtin by name — check before evaluating the callee to avoid unknownIdentifier
  if (node.callee.type === "name") {
    const nameUpper = node.callee.name.toUpperCase();
    if (isBuiltinName(nameUpper)) {
      const args: FormulaValue[] = [];
      for (const arg of node.args) {
        const r = evalNode(arg, ctx);
        if (r.diagnostics.length > 0) return r;
        args.push(r.value);
      }
      return callBuiltin(nameUpper, args, { limits: ctx.limits, span: node.span, evalArg: i => evalNode(node.args[i], ctx) });
    }
  }

  // Evaluate callee as a value (e.g., a lambda variable or first-class function)
  const calleeR = evalNode(node.callee, ctx);
  if (calleeR.diagnostics.length > 0) return calleeR;

  // Evaluate all args eagerly
  const args: FormulaValue[] = [];
  for (const arg of node.args) {
    const r = evalNode(arg, ctx);
    if (r.diagnostics.length > 0) return r;
    args.push(r.value);
  }

  const callee = calleeR.value;

  if (callee.kind !== "function") {
    return fail(typeError(`Cannot call a ${callee.kind} value`, node.span));
  }

  return applyFunction(callee.fn, args, node, ctx);
}

function applyFunction(
  fn: FormulaFunction,
  args: FormulaValue[],
  node: import("./ast.js").CallNode,
  ctx: EvalContext
): EvalResult {
  if (fn.kind === "builtin") {
    const result = callBuiltin(fn.name, args, { limits: ctx.limits, span: node.span, evalArg: i => evalNode(node.args[i], ctx) });
    return result;
  }

  // Lambda application
  if (args.length !== fn.parameters.length) {
    return fail({ code: "wrong_arity", message: `Lambda expects ${fn.parameters.length} argument(s), got ${args.length}`, span: node.span });
  }

  ctx.callDepth++;
  if (ctx.callDepth > ctx.limits.maxCallDepth) {
    ctx.callDepth--;
    return fail(limitExceeded("maxCallDepth", ctx.callDepth, ctx.limits.maxCallDepth, node.span));
  }

  const savedEnv = ctx.env;
  const newEnv = new Map(ctx.env);

  // Install captured bindings
  for (const cap of fn.capturedBindings) {
    newEnv.set(normalizeKey(cap.name), cap.value);
  }
  // Install arguments
  for (let i = 0; i < fn.parameters.length; i++) {
    newEnv.set(normalizeKey(fn.parameters[i]), args[i]);
  }
  ctx.env = newEnv;

  const result = evalNode(fn.body, ctx);

  ctx.env = savedEnv;
  ctx.callDepth--;

  return result;
}

function evalLambda(node: import("./ast.js").LambdaNode, ctx: EvalContext): EvalResult {
  // Capture current env for lexical scoping
  const captured: import("./value.js").CapturedLexicalBinding[] = [];
  for (const [name, value] of ctx.env) {
    if (!node.parameters.map(p => normalizeKey(p)).includes(name)) {
      captured.push({ name, value });
    }
  }
  const identityDigest = createHash("sha256")
    .update(node.normalizedSource || node.id)
    .digest("hex")
    .slice(0, 32);
  const fn: LambdaFunction = {
    kind: "lambda",
    parameters: node.parameters,
    body: node.body,
    normalizedSource: node.normalizedSource,
    capturedBindings: captured,
    identityDigest
  };
  return ok({ kind: "function", fn });
}

function evalFieldAccess(node: import("./ast.js").FieldAccessNode, ctx: EvalContext): EvalResult {
  const targetR = evalNode(node.target, ctx);
  if (targetR.diagnostics.length > 0) return targetR;
  const v = targetR.value;

  if (v.kind === "record") {
    const idx = v.table.fields.indexOf(node.fieldName);
    if (idx === -1) return fail(unknownField(node.fieldName, node.span));
    return ok(v.table.rows[0][idx]);
  }

  if (v.kind === "table") {
    const idx = v.table.fields.indexOf(node.fieldName);
    if (idx === -1) return fail(unknownField(node.fieldName, node.span));
    // Return as a list
    const cells = v.table.rows.map(row => row[idx]);
    return ok(makeList(cells));
  }

  return fail(typeError(`Field access requires record or table, got ${v.kind}`, node.span));
}

function resolveIndex(rawIndex: number, length: number, span: import("./tokens.js").SourceSpan | undefined): number | FormulaDiagnostic {
  if (rawIndex === 0) return invalidIndex(span);
  const resolved = rawIndex < 0 ? length + rawIndex + 1 : rawIndex;
  if (resolved < 1 || resolved > length) return indexOutOfRange(rawIndex, length, span);
  return resolved;
}

function evalIndex(node: import("./ast.js").IndexNode, ctx: EvalContext): EvalResult {
  const targetR = evalNode(node.target, ctx);
  if (targetR.diagnostics.length > 0) return targetR;
  const indexR = evalNode(node.index, ctx);
  if (indexR.diagnostics.length > 0) return indexR;

  const v = targetR.value;
  const idxV = indexR.value;

  if (idxV.kind !== "number") return fail(typeError("Index must be a number", node.span));
  if (idxV.value.denominator !== 1n) return fail({ code: "invalid_index", message: "Index must be an integer", span: node.span });
  const rawIdx = Number(idxV.value.numerator);

  if (v.kind === "list") {
    const r = resolveIndex(rawIdx, v.table.rows.length, node.span);
    if (typeof r !== "number") return fail(r);
    return ok(v.table.rows[r - 1][0]);
  }

  if (v.kind === "table") {
    const r = resolveIndex(rawIdx, v.table.rows.length, node.span);
    if (typeof r !== "number") return fail(r);
    return ok(makeRecord([...v.table.fields], [...v.table.rows[r - 1]]));
  }

  return fail(typeError(`Index requires list or table, got ${v.kind}`, node.span));
}

function normalizeSliceBound(bound: number | undefined, length: number, isEnd: boolean): number {
  if (bound === undefined) return isEnd ? length + 1 : 1;
  const resolved = bound < 0 ? length + bound + 1 : bound;
  return Math.max(1, Math.min(length + 1, resolved));
}

function evalSlice(node: import("./ast.js").SliceNode, ctx: EvalContext): EvalResult {
  const targetR = evalNode(node.target, ctx);
  if (targetR.diagnostics.length > 0) return targetR;
  const v = targetR.value;

  if (v.kind === "record") return fail(typeError("Slice not applicable to record", node.span));

  if (v.kind === "list") {
    const len = v.table.rows.length;
    const start = normalizeSliceBound(node.start, len, false);
    const end = normalizeSliceBound(node.end, len, true);
    if (end <= start) return ok(makeList([]));
    return ok(makeList(v.table.rows.slice(start - 1, end - 1).map(r => r[0])));
  }

  if (v.kind === "table") {
    const len = v.table.rows.length;
    const start = normalizeSliceBound(node.start, len, false);
    const end = normalizeSliceBound(node.end, len, true);
    if (end <= start) return ok(makeTable([...v.table.fields], []));
    const rows = v.table.rows.slice(start - 1, end - 1).map(r => [...r]);
    return ok(makeTable([...v.table.fields], rows));
  }

  return fail(typeError(`Slice requires list or table, got ${v.kind}`, node.span));
}

function evalSetOperation(node: import("./ast.js").SetOperationNode, ctx: EvalContext): EvalResult {
  const targetR = evalNode(node.target, ctx);
  if (targetR.diagnostics.length > 0) return targetR;
  const v = targetR.value;

  const table = toTable(v);
  if (!table) return fail(typeError(`Set operation requires record or table, got ${v.kind}`, node.span));

  if (node.body.kind === "field-projection") {
    return evalProjection(table, v.kind, node.body.fields, node);
  }

  // condition-query
  return evalConditionQuery(table, v.kind, node.body.condition, node, ctx);
}

function toTable(v: FormulaValue): FormulaTable | null {
  if (v.kind === "table") return v.table;
  if (v.kind === "record") return v.table;
  return null;
}

function evalProjection(
  table: FormulaTable,
  origKind: string,
  fields: readonly string[],
  node: import("./ast.js").SetOperationNode
): EvalResult {
  if (fields.length === 0) {
    return origKind === "record"
      ? ok(makeRecord([], []))
      : ok(makeTable([], table.rows.map(() => [])));
  }
  for (const f of fields) {
    if (!table.fields.includes(f)) return fail(unknownField(f, node.span));
  }
  const indices = fields.map(f => table.fields.indexOf(f));
  const newRows = table.rows.map(row => indices.map(i => row[i]));
  if (origKind === "record") {
    return ok(makeRecord([...fields], newRows[0] ?? []));
  }
  return ok(makeTable([...fields], newRows));
}

function evalConditionQuery(
  table: FormulaTable,
  origKind: string,
  condition: FormulaConditionNode,
  node: import("./ast.js").SetOperationNode,
  ctx: EvalContext
): EvalResult {
  const matchingRows: (readonly FormulaValue[])[] = [];

  for (const row of table.rows) {
    // Temporarily set row fields in env (field-first scoping)
    const savedEnv = ctx.env;
    const rowEnv = new Map(ctx.env);
    for (let i = 0; i < table.fields.length; i++) {
      rowEnv.set(normalizeKey(table.fields[i]), row[i]);
    }
    ctx.env = rowEnv;

    const r = evalCondition(condition, ctx, node.span);

    ctx.env = savedEnv;

    if (r.diagnostics.length > 0) return { value: NULL_VALUE, diagnostics: r.diagnostics };
    if (r.value) matchingRows.push(row);
  }

  return ok(makeTable([...table.fields], matchingRows.map(r => [...r])));
}

function evalCondition(
  cond: FormulaConditionNode,
  ctx: EvalContext,
  span: import("./tokens.js").SourceSpan | undefined
): { value: boolean; diagnostics: FormulaDiagnostic[] } {
  switch (cond.type) {
    case "field-condition": {
      const fieldVal = ctx.env.get(normalizeKey(cond.field));
      if (fieldVal === undefined) {
        return { value: false, diagnostics: [unknownField(cond.field, cond.span)] };
      }
      const exprR = evalNode(cond.value, ctx);
      if (exprR.diagnostics.length > 0) return { value: false, diagnostics: exprR.diagnostics };
      const cmpResult = compareForCondition(fieldVal, cond.operator, exprR.value, cond.span);
      if (typeof cmpResult === "boolean") return { value: cmpResult, diagnostics: [] };
      return { value: false, diagnostics: [cmpResult] };
    }
    case "condition-not": {
      const inner = evalCondition(cond.condition, ctx, cond.span);
      if (inner.diagnostics.length > 0) return inner;
      return { value: !inner.value, diagnostics: [] };
    }
    case "condition-composition": {
      const results = cond.conditions.map(c => evalCondition(c, ctx, cond.span));
      const errs = results.flatMap(r => r.diagnostics);
      if (errs.length > 0) return { value: false, diagnostics: errs };
      const bools = results.map(r => r.value);
      switch (cond.operator) {
        case "and": return { value: bools.every(Boolean), diagnostics: [] };
        case "or": return { value: bools.some(Boolean), diagnostics: [] };
        case "xor": return { value: bools.filter(Boolean).length % 2 === 1, diagnostics: [] };
      }
    }
  }
}

function compareForCondition(
  lv: FormulaValue,
  op: import("./ast.js").ConditionOperator,
  rv: FormulaValue,
  span: import("./tokens.js").SourceSpan | undefined
): boolean | FormulaDiagnostic {
  if (op === "=" || op === "!=") {
    const eq2 = formulaEqual(lv, rv);
    return op === "=" ? eq2 : !eq2;
  }
  if (lv.kind === "number" && rv.kind === "number") {
    const c = compare(lv.value, rv.value);
    switch (op) {
      case "<": return c < 0;
      case "<=": return c <= 0;
      case ">": return c > 0;
      case ">=": return c >= 0;
    }
  }
  if (lv.kind === "text" && rv.kind === "text") {
    const c = lv.value < rv.value ? -1 : lv.value > rv.value ? 1 : 0;
    switch (op) {
      case "<": return c < 0;
      case "<=": return c <= 0;
      case ">": return c > 0;
      case ">=": return c >= 0;
    }
  }
  return typeError(`Cannot compare ${lv.kind} with ${rv.kind} using '${op}'`, span);
}

function evalCardinality(node: import("./ast.js").CardinalityPromotionNode, ctx: EvalContext): EvalResult {
  const targetR = evalNode(node.target, ctx);
  if (targetR.diagnostics.length > 0) return targetR;
  const v = targetR.value;

  if (v.kind === "record") return ok(v); // record unchanged by ! or ?

  if (v.kind === "table") {
    const rows = v.table.rows.length;
    if (node.mode === "exactly-one") {
      if (rows === 1) return ok(makeRecord([...v.table.fields], [...v.table.rows[0]]));
      return fail(cardinalityError(`Expected exactly one row, got ${rows}`, node.span));
    } else {
      if (rows === 0) return ok(NULL_VALUE);
      if (rows === 1) return ok(makeRecord([...v.table.fields], [...v.table.rows[0]]));
      return fail(cardinalityError(`Expected zero or one row, got ${rows}`, node.span));
    }
  }

  return fail(typeError(`Cardinality promotion requires record or table, got ${v.kind}`, node.span));
}

// ─── Public entry ─────────────────────────────────────────────────────────────

export interface EvaluationOutput {
  readonly value: FormulaValue;
  readonly diagnostics: FormulaDiagnostic[];
  readonly observedDependencies: readonly ObservedDependency[];
  readonly steps: number;
}

export function evaluate(
  root: FormulaNode,
  snapshot: FormulaResolverSnapshot,
  limits: FormulaLimits
): EvaluationOutput {
  const ctx: EvalContext = {
    snapshot,
    limits,
    steps: 0,
    callDepth: 0,
    observed: new Map(),
    env: new Map()
  };
  const result = evalNode(root, ctx);
  return {
    value: result.value,
    diagnostics: result.diagnostics,
    observedDependencies: [...ctx.observed.values()],
    steps: ctx.steps
  };
}
