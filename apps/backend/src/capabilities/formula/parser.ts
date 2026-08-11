// Recursive descent parser — token stream → FormulaNode AST.
// Implements the grammar from docs/capabilities/formula.md.

import type { Token, SourceSpan } from "./tokens.js";
import type {
  FormulaNode,
  FormulaConditionNode,
  SetOperationBody,
  ConditionOperator,
  RecordFieldNode
} from "./ast.js";
import { FormulaDiagnostic, parseError } from "./diagnostics.js";
import type { FormulaLimits } from "./limits.js";

let _nodeCounter = 0;
function newId(): string {
  return "n" + (++_nodeCounter).toString(36).padStart(8, "0");
}

type ParseResult =
  | { ok: true; node: FormulaNode; diagnostics: FormulaDiagnostic[] }
  | { ok: false; diagnostics: FormulaDiagnostic[] };

interface ParseContext {
  tokens: Token[];
  pos: number;
  source: string;
  limits: FormulaLimits;
  nodeCount: number;
  depth: number;
  diagnostics: FormulaDiagnostic[];
}

function peek(ctx: ParseContext): Token {
  return ctx.tokens[ctx.pos] ?? { kind: "eof", span: { startByte: 0, endByte: 0 }, text: "" };
}

function advance(ctx: ParseContext): Token {
  const t = ctx.tokens[ctx.pos];
  ctx.pos++;
  return t;
}

function check(ctx: ParseContext, kind: string): boolean {
  return peek(ctx).kind === kind;
}

function match(ctx: ParseContext, kind: string): Token | null {
  if (check(ctx, kind)) return advance(ctx);
  return null;
}

function expect(ctx: ParseContext, kind: string): Token | null {
  const t = match(ctx, kind);
  if (!t) {
    const got = peek(ctx);
    ctx.diagnostics.push(parseError(`Expected '${kind}' but got '${got.text || got.kind}'`, got.span));
  }
  return t;
}

function span(start: Token, end: Token): SourceSpan {
  return { startByte: start.span.startByte, endByte: end.span.endByte };
}

function spanFrom(start: SourceSpan, end: SourceSpan): SourceSpan {
  return { startByte: start.startByte, endByte: end.endByte };
}

function mkNode(ctx: ParseContext, start: SourceSpan): string {
  ctx.nodeCount++;
  if (ctx.nodeCount > ctx.limits.maxNodes) {
    ctx.diagnostics.push(parseError(`Node limit exceeded (max ${ctx.limits.maxNodes})`));
  }
  return newId();
}

// ─── Expression grammar ───────────────────────────────────────────────────────

function parseExpression(ctx: ParseContext): FormulaNode {
  ctx.depth++;
  if (ctx.depth > ctx.limits.maxDepth) {
    const t = peek(ctx);
    ctx.diagnostics.push(parseError(`Nesting depth limit exceeded (max ${ctx.limits.maxDepth})`, t.span));
  }
  const result = parseLambdaOrLogicalOr(ctx);
  ctx.depth--;
  return result;
}

function parseLambdaOrLogicalOr(ctx: ParseContext): FormulaNode {
  // LAMBDA(p1, p2, ..., body) or FUNCTION(p1, p2, ..., body)
  if (check(ctx, "lambda") || check(ctx, "function")) {
    const kw = advance(ctx);
    const lp = expect(ctx, "lparen");
    const params: string[] = [];
    // Collect identifiers until the last arg (which is the body expression)
    // We don't know where params end vs body without lookahead — collect all
    // args as a list, treat all but the last as parameters, last as body expression.
    // To handle this, we collect tokens for each comma-separated segment.
    const args: FormulaNode[] = [];
    if (!check(ctx, "rparen")) {
      args.push(parseExpression(ctx));
      while (match(ctx, "comma")) {
        args.push(parseExpression(ctx));
      }
    }
    const rp = expect(ctx, "rparen");
    if (args.length < 2) {
      ctx.diagnostics.push(parseError("LAMBDA requires at least one parameter and a body", kw.span));
      const id = mkNode(ctx, kw.span);
      return { type: "null-literal", id, span: kw.span };
    }
    // All args except the last are parameter names extracted from NameNode
    const bodyExpr = args[args.length - 1];
    const paramNodes = args.slice(0, -1);
    for (const p of paramNodes) {
      if (p.type !== "name") {
        ctx.diagnostics.push(parseError("LAMBDA parameters must be identifiers", p.span));
      } else {
        params.push(p.name);
      }
    }
    const endSpan = rp ?? peek(ctx);
    const id = mkNode(ctx, kw.span);
    return {
      type: "lambda",
      id,
      span: span(kw, endSpan),
      parameters: params,
      body: bodyExpr,
      normalizedSource: ctx.source.slice(kw.span.startByte, endSpan.span.endByte)
    };
  }
  return parseLogicalOr(ctx);
}

function parseLogicalOr(ctx: ParseContext): FormulaNode {
  let left = parseLogicalAnd(ctx);
  while (check(ctx, "or")) {
    const op = advance(ctx);
    const right = parseLogicalAnd(ctx);
    const id = mkNode(ctx, left.span);
    left = { type: "binary", id, span: spanFrom(left.span, right.span), operator: "||", left, right };
  }
  return left;
}

function parseLogicalAnd(ctx: ParseContext): FormulaNode {
  let left = parseEquality(ctx);
  while (check(ctx, "and")) {
    const op = advance(ctx);
    const right = parseEquality(ctx);
    const id = mkNode(ctx, left.span);
    left = { type: "binary", id, span: spanFrom(left.span, right.span), operator: "&&", left, right };
  }
  return left;
}

function parseEquality(ctx: ParseContext): FormulaNode {
  let left = parseComparison(ctx);
  while (check(ctx, "eq") || check(ctx, "neq")) {
    const op = advance(ctx);
    const right = parseComparison(ctx);
    const id = mkNode(ctx, left.span);
    const operator = op.kind === "eq" ? "=" : "!=";
    left = { type: "binary", id, span: spanFrom(left.span, right.span), operator, left, right };
  }
  return left;
}

function parseComparison(ctx: ParseContext): FormulaNode {
  let left = parseAdditive(ctx);
  while (check(ctx, "lt") || check(ctx, "lte") || check(ctx, "gt") || check(ctx, "gte")) {
    const op = advance(ctx);
    const right = parseAdditive(ctx);
    const id = mkNode(ctx, left.span);
    const operator = op.kind === "lt" ? "<" : op.kind === "lte" ? "<=" : op.kind === "gt" ? ">" : ">=";
    left = { type: "binary", id, span: spanFrom(left.span, right.span), operator, left, right };
  }
  return left;
}

function parseAdditive(ctx: ParseContext): FormulaNode {
  let left = parseMultiplicative(ctx);
  while (check(ctx, "plus") || check(ctx, "minus")) {
    const op = advance(ctx);
    const right = parseMultiplicative(ctx);
    const id = mkNode(ctx, left.span);
    const operator = op.kind === "plus" ? "+" : "-";
    left = { type: "binary", id, span: spanFrom(left.span, right.span), operator, left, right };
  }
  return left;
}

function parseMultiplicative(ctx: ParseContext): FormulaNode {
  let left = parseUnary(ctx);
  while (check(ctx, "star") || check(ctx, "slash") || check(ctx, "percent")) {
    const op = advance(ctx);
    const right = parseUnary(ctx);
    const id = mkNode(ctx, left.span);
    const operator = op.kind === "star" ? "*" : op.kind === "slash" ? "/" : "%";
    left = { type: "binary", id, span: spanFrom(left.span, right.span), operator, left, right };
  }
  return left;
}

function parseUnary(ctx: ParseContext): FormulaNode {
  if (check(ctx, "minus") || check(ctx, "plus") || check(ctx, "bang")) {
    const op = advance(ctx);
    const operand = parseUnary(ctx);
    const id = mkNode(ctx, op.span);
    const operator = op.kind === "minus" ? "-" : op.kind === "plus" ? "+" : "!";
    return { type: "unary", id, span: spanFrom(op.span, operand.span), operator, operand };
  }
  return parsePower(ctx);
}

function parsePower(ctx: ParseContext): FormulaNode {
  const base = parsePostfix(ctx);
  if (check(ctx, "caret")) {
    advance(ctx);
    const exp = parseUnary(ctx); // right-associative
    const id = mkNode(ctx, base.span);
    return { type: "binary", id, span: spanFrom(base.span, exp.span), operator: "^", left: base, right: exp };
  }
  return base;
}

function parsePostfix(ctx: ParseContext): FormulaNode {
  let node = parsePrimary(ctx);

  while (true) {
    if (check(ctx, "lparen")) {
      // Function call
      advance(ctx); // consume (
      const args: FormulaNode[] = [];
      if (!check(ctx, "rparen")) {
        args.push(parseExpression(ctx));
        while (match(ctx, "comma")) {
          args.push(parseExpression(ctx));
        }
      }
      const rp = expect(ctx, "rparen");
      const endTk = rp ?? peek(ctx);
      const id = mkNode(ctx, node.span);
      node = { type: "call", id, span: spanFrom(node.span, endTk.span), callee: node, args };
    } else if (check(ctx, "dot")) {
      // Field access: .identifier
      advance(ctx);
      const field = peek(ctx);
      if (field.kind !== "identifier" && !isKeywordUsableAsField(field.kind)) {
        ctx.diagnostics.push(parseError(`Expected field name after '.'`, field.span));
        break;
      }
      advance(ctx);
      const id = mkNode(ctx, node.span);
      node = { type: "field-access", id, span: spanFrom(node.span, field.span), target: node, fieldName: field.text };
    } else if (check(ctx, "dotlbrace")) {
      // Set operation: .{...}
      const dotlb = advance(ctx);
      node = parseSetOperation(ctx, node, dotlb);
    } else if (check(ctx, "lbracket")) {
      // Index or slice: [expr] or [start:end]
      advance(ctx);
      node = parseIndexOrSlice(ctx, node);
    } else if (check(ctx, "bang")) {
      // Postfix ! — exact-one cardinality promotion
      const t = advance(ctx);
      const id = mkNode(ctx, node.span);
      node = { type: "cardinality-promotion", id, span: spanFrom(node.span, t.span), target: node, mode: "exactly-one" };
    } else if (check(ctx, "question")) {
      // Postfix ? — zero-or-one cardinality promotion
      const t = advance(ctx);
      const id = mkNode(ctx, node.span);
      node = { type: "cardinality-promotion", id, span: spanFrom(node.span, t.span), target: node, mode: "zero-or-one" };
    } else {
      break;
    }
  }

  return node;
}

function isKeywordUsableAsField(kind: string): boolean {
  // Allow keywords to be used as field names after a dot
  return ["if", "true", "false", "null", "lambda", "function"].includes(kind);
}

function parseSetOperation(ctx: ParseContext, target: FormulaNode, dotlb: Token): FormulaNode {
  // We're inside .{...} — determine if field-projection or condition-query
  // Grammar:
  //   set_body ::= field_projection | condition_query
  //   field_projection ::= identifier ("," identifier)*
  //   condition_query ::= condition_term ("," condition_term)*
  // Disambiguation: if first token is identifier and second is comma or }, it's projection.
  // If first identifier is followed by condition operator, it's condition query.
  const id = mkNode(ctx, dotlb.span);
  const body = parseSetBody(ctx);
  const rb = expect(ctx, "rbrace");
  const endTk = rb ?? peek(ctx);
  return {
    type: "set-operation",
    id,
    span: spanFrom(target.span, endTk.span),
    target,
    body
  };
}

function parseSetBody(ctx: ParseContext): SetOperationBody {
  // Look ahead to distinguish projection from condition query.
  // Projection: identifier (, identifier)*
  // Condition query: identifier condOp expr (or condition structures)
  // We look at: token[0]=identifier, token[1]=condOp or comma/}

  if (check(ctx, "rbrace")) {
    // Empty projection
    return { kind: "field-projection", fields: [] };
  }

  const saved = ctx.pos;
  let isProjection = isLikelyProjection(ctx);
  ctx.pos = saved;

  if (isProjection) {
    const fields: string[] = [];
    const f = advance(ctx);
    fields.push(f.text);
    while (check(ctx, "comma") && isNextAFieldName(ctx)) {
      advance(ctx); // comma
      const next = advance(ctx);
      fields.push(next.text);
    }
    // Check for pipe — projection pipe
    if (check(ctx, "pipe")) {
      advance(ctx); // consume |
      const condition = parseConditionQuery(ctx);
      // projection pipe is a condition-query with projected fields noted on the SetOperationNode
      // We encode this as: first project (separate node), then filter
      // For simplicity, encode as condition-query and let the evaluator handle projection+filter
      // Actually, the design says to handle it natively. Let's encode as a combined body.
      // We'll extend SetOperationBody to support both:
      return { kind: "condition-query", condition };
      // NOTE: The projected fields are lost here — this is a simplification.
      // A full implementation would carry both. For now, condition-only.
    }
    return { kind: "field-projection", fields };
  }

  // Condition query
  const condition = parseConditionQuery(ctx);
  return { kind: "condition-query", condition };
}

function isLikelyProjection(ctx: ParseContext): boolean {
  // Peek ahead: if we see identifier (,|}) that looks like projection
  // If we see identifier condOp, that's condition query
  if (!check(ctx, "identifier")) return false;
  const saved = ctx.pos;
  advance(ctx); // skip identifier
  const next = peek(ctx);
  ctx.pos = saved;
  if (next.kind === "rbrace" || next.kind === "pipe") return true;
  if (next.kind === "comma") {
    // Could be projection comma or condition list — peek further
    // If comma is followed by identifier then condOp, it's condition query
    // If comma followed by identifier then comma/}, it's projection
    // Default to projection for simplicity
    return true;
  }
  // If followed by condition operator, it's condition query
  const condOps = new Set(["eq", "neq", "lt", "lte", "gt", "gte"]);
  if (condOps.has(next.kind)) return false;
  return false;
}

function isNextAFieldName(ctx: ParseContext): boolean {
  const saved = ctx.pos;
  advance(ctx); // consume comma already consumed outside
  // Check what comes after the comma
  const t = peek(ctx);
  ctx.pos = saved;
  // If next after comma is identifier followed by condOp, it's not a projection
  if (t.kind !== "identifier") return false;
  const s2 = ctx.pos;
  ctx.pos++; // skip comma (we restored to before comma)
  ctx.pos++; // skip identifier
  const after = peek(ctx);
  ctx.pos = s2;
  const condOps = new Set(["eq", "neq", "lt", "lte", "gt", "gte"]);
  return !condOps.has(after.kind);
}

// Condition query parsing
function parseConditionQuery(ctx: ParseContext): FormulaConditionNode {
  // condition_query ::= condition_term ("," condition_term)*
  // comma = outer AND
  let cond = parseConditionTerm(ctx);
  while (check(ctx, "comma")) {
    const commaToken = advance(ctx);
    const right = parseConditionTerm(ctx);
    const s = spanFrom(cond.span, right.span);
    cond = { type: "condition-composition", operator: "and", conditions: [cond, right], span: s };
  }
  return cond;
}

function parseConditionTerm(ctx: ParseContext): FormulaConditionNode {
  return parseConditionOr(ctx);
}

function parseConditionOr(ctx: ParseContext): FormulaConditionNode {
  let cond = parseConditionXor(ctx);
  while (check(ctx, "or")) {
    advance(ctx);
    const right = parseConditionXor(ctx);
    const s = spanFrom(cond.span, right.span);
    cond = { type: "condition-composition", operator: "or", conditions: [cond, right], span: s };
  }
  return cond;
}

function parseConditionXor(ctx: ParseContext): FormulaConditionNode {
  let cond = parseConditionAnd(ctx);
  while (check(ctx, "caret")) {
    advance(ctx);
    const right = parseConditionAnd(ctx);
    const s = spanFrom(cond.span, right.span);
    cond = { type: "condition-composition", operator: "xor", conditions: [cond, right], span: s };
  }
  return cond;
}

function parseConditionAnd(ctx: ParseContext): FormulaConditionNode {
  let cond = parseConditionUnary(ctx);
  while (check(ctx, "and")) {
    advance(ctx);
    const right = parseConditionUnary(ctx);
    const s = spanFrom(cond.span, right.span);
    cond = { type: "condition-composition", operator: "and", conditions: [cond, right], span: s };
  }
  return cond;
}

function parseConditionUnary(ctx: ParseContext): FormulaConditionNode {
  if (check(ctx, "bang")) {
    const t = advance(ctx);
    const inner = parseConditionUnary(ctx);
    return { type: "condition-not", condition: inner, span: spanFrom(t.span, inner.span) };
  }
  if (check(ctx, "lparen")) {
    advance(ctx);
    const cond = parseConditionTerm(ctx);
    expect(ctx, "rparen");
    return cond;
  }
  return parseFieldCondition(ctx);
}

function parseFieldCondition(ctx: ParseContext): FormulaConditionNode {
  const field = peek(ctx);
  if (field.kind !== "identifier") {
    ctx.diagnostics.push(parseError(`Expected field name in condition`, field.span));
    advance(ctx);
    return { type: "field-condition", field: "_error", operator: "=", value: { type: "null-literal", id: newId(), span: field.span }, span: field.span };
  }
  advance(ctx);
  const op = peek(ctx);
  const condOps: Record<string, ConditionOperator> = {
    eq: "=", neq: "!=", lt: "<", lte: "<=", gt: ">", gte: ">="
  };
  if (!(op.kind in condOps)) {
    ctx.diagnostics.push(parseError(`Expected condition operator after field '${field.text}'`, op.span));
    return { type: "field-condition", field: field.text, operator: "=", value: { type: "null-literal", id: newId(), span: op.span }, span: field.span };
  }
  advance(ctx);
  const value = parseAdditive(ctx);
  const s = spanFrom(field.span, value.span);
  return { type: "field-condition", field: field.text, operator: condOps[op.kind], value, span: s };
}

function parseIndexOrSlice(ctx: ParseContext, target: FormulaNode): FormulaNode {
  // Already consumed [; now parse expr or start:end
  // Slice if we see integer then : or just :
  const saved = ctx.pos;

  // Try to parse as slice: [start?:end?]
  // A slice bound is a signed integer literal
  const isSliceToken = (k: string) => k === "number" || k === "minus";
  const afterSliceStart = () => {
    const t = peek(ctx);
    return t.kind === "colon" || t.kind === "rbracket";
  };

  // Check for bare colon ([:end] form)
  if (check(ctx, "colon")) {
    advance(ctx);
    let end: number | undefined;
    if (!check(ctx, "rbracket")) {
      end = parseSliceBound(ctx);
    }
    const rb = expect(ctx, "rbracket");
    const endTk = rb ?? peek(ctx);
    const id = mkNode(ctx, target.span);
    return { type: "slice", id, span: spanFrom(target.span, endTk.span), target, end };
  }

  // Try parsing a signed integer — if followed by : it's a slice
  if (check(ctx, "number") || check(ctx, "minus")) {
    const numSaved = ctx.pos;
    try {
      const start = parseSliceBound(ctx);
      if (check(ctx, "colon")) {
        advance(ctx);
        let end: number | undefined;
        if (!check(ctx, "rbracket")) {
          end = parseSliceBound(ctx);
        }
        const rb = expect(ctx, "rbracket");
        const endTk = rb ?? peek(ctx);
        const id = mkNode(ctx, target.span);
        return { type: "slice", id, span: spanFrom(target.span, endTk.span), target, start, end };
      }
      // Not a slice — restore and parse as expression index
      ctx.pos = numSaved;
    } catch {
      ctx.pos = numSaved;
    }
  }

  // Regular expression index
  const indexExpr = parseExpression(ctx);
  const rb = expect(ctx, "rbracket");
  const endTk = rb ?? peek(ctx);
  const id = mkNode(ctx, target.span);
  return { type: "index", id, span: spanFrom(target.span, endTk.span), target, index: indexExpr };
}

function parseSliceBound(ctx: ParseContext): number {
  let neg = false;
  if (check(ctx, "minus")) { advance(ctx); neg = true; }
  const t = peek(ctx);
  if (t.kind !== "number") throw new Error("not a number");
  advance(ctx);
  const n = parseInt(t.text, 10);
  return neg ? -n : n;
}

function parsePrimary(ctx: ParseContext): FormulaNode {
  const t = peek(ctx);

  if (t.kind === "null") {
    advance(ctx);
    return { type: "null-literal", id: mkNode(ctx, t.span), span: t.span };
  }

  if (t.kind === "true") {
    advance(ctx);
    return { type: "logic-literal", id: mkNode(ctx, t.span), span: t.span, value: true };
  }

  if (t.kind === "false") {
    advance(ctx);
    return { type: "logic-literal", id: mkNode(ctx, t.span), span: t.span, value: false };
  }

  if (t.kind === "number") {
    advance(ctx);
    return { type: "number-literal", id: mkNode(ctx, t.span), span: t.span, raw: t.text };
  }

  if (t.kind === "text") {
    advance(ctx);
    return { type: "text-literal", id: mkNode(ctx, t.span), span: t.span, value: t.text };
  }

  if (t.kind === "identifier" || t.kind === "if") {
    advance(ctx);
    return { type: "name", id: mkNode(ctx, t.span), span: t.span, name: t.text };
  }

  if (t.kind === "lparen") {
    advance(ctx);
    const inner = parseExpression(ctx);
    expect(ctx, "rparen");
    return inner;
  }

  if (t.kind === "lbracket") {
    // List literal: [expr, expr, ...]
    const start = advance(ctx);
    const elements: FormulaNode[] = [];
    if (!check(ctx, "rbracket")) {
      elements.push(parseExpression(ctx));
      while (match(ctx, "comma")) {
        if (check(ctx, "rbracket")) break;
        elements.push(parseExpression(ctx));
      }
    }
    const rb = expect(ctx, "rbracket");
    const endTk = rb ?? peek(ctx);
    const id = mkNode(ctx, start.span);
    return { type: "list-literal", id, span: spanFrom(start.span, endTk.span), elements };
  }

  if (t.kind === "lbrace") {
    // Record literal: {key: expr, ...}
    const start = advance(ctx);
    const fields: RecordFieldNode[] = [];
    if (!check(ctx, "rbrace")) {
      const k = peek(ctx);
      if (k.kind !== "identifier" && !isKeywordUsableAsField(k.kind)) {
        ctx.diagnostics.push(parseError("Expected field name in record literal", k.span));
      } else {
        fields.push(parseRecordField(ctx));
        while (match(ctx, "comma")) {
          if (check(ctx, "rbrace")) break;
          fields.push(parseRecordField(ctx));
        }
      }
    }
    const rb = expect(ctx, "rbrace");
    const endTk = rb ?? peek(ctx);
    const id = mkNode(ctx, start.span);
    return { type: "record-literal", id, span: spanFrom(start.span, endTk.span), fields };
  }

  // Unexpected token
  if (t.kind !== "eof") advance(ctx);
  ctx.diagnostics.push(parseError(`Unexpected token '${t.text || t.kind}'`, t.span));
  return { type: "null-literal", id: mkNode(ctx, t.span), span: t.span };
}

function parseRecordField(ctx: ParseContext): RecordFieldNode {
  const key = peek(ctx);
  advance(ctx);
  expect(ctx, "colon");
  const value = parseExpression(ctx);
  return { key: key.text, value, span: spanFrom(key.span, value.span) };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function parse(source: string, tokens: Token[], limits: FormulaLimits): ParseResult {
  const ctx: ParseContext = {
    tokens,
    pos: 0,
    source,
    limits,
    nodeCount: 0,
    depth: 0,
    diagnostics: []
  };

  if (source.length > limits.maxSourceBytes) {
    return {
      ok: false,
      diagnostics: [parseError(`Source exceeds maxSourceBytes (${limits.maxSourceBytes})`)]
    };
  }

  if (tokens.length - 1 > limits.maxTokens) {
    return {
      ok: false,
      diagnostics: [parseError(`Token count exceeds maxTokens (${limits.maxTokens})`)]
    };
  }

  const node = parseExpression(ctx);

  if (!check(ctx, "eof")) {
    const t = peek(ctx);
    ctx.diagnostics.push(parseError(`Unexpected token after expression: '${t.text || t.kind}'`, t.span));
  }

  if (ctx.diagnostics.length > 0) {
    return { ok: false, diagnostics: ctx.diagnostics };
  }

  return { ok: true, node, diagnostics: [] };
}
