// FormulaEngine — the single public in-process interface.
// Receives Logger for timing, limit violations, and unexpected branches.

import { createHash } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type { FormulaLimits } from "./limits.js";
import type { FormulaValue } from "./value.js";
import type { FormulaNode } from "./ast.js";
import type { FormulaDiagnostic } from "./diagnostics.js";
import { limitExceeded } from "./diagnostics.js";
import type { FormulaResolverSnapshot } from "./resolver.js";
import type { FormulaDependencyResult, ObservedDependency } from "./dependencies.js";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { bind } from "./binder.js";
import { extractDependencies } from "./dependencies.js";
import { evaluate, EVALUATOR_VERSION } from "./evaluator.js";
import { formulaValueIdentityPayload } from "./value-identity.js";

export type FormulaLanguageVersion = "formula/v1";

export interface FormulaExpression {
  readonly languageVersion: FormulaLanguageVersion;
  readonly source: string;
  readonly sourceDigest: string;
  readonly root: FormulaNode;
}

export interface FormulaResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly diagnostics?: FormulaDiagnostic[];
}

function okResult<T>(value: T): FormulaResult<T> {
  return { ok: true, value };
}

function failResult<T>(diagnostics: FormulaDiagnostic[]): FormulaResult<T> {
  return { ok: false, diagnostics };
}

export interface ParseFormulaRequest {
  readonly source: string;
  readonly languageVersion: FormulaLanguageVersion;
  readonly limits?: Partial<FormulaLimits>;
}

export interface ValidateFormulaRequest {
  readonly expression: FormulaExpression;
  readonly resolver?: FormulaResolverSnapshot;
  readonly limits?: Partial<FormulaLimits>;
}

export interface FormulaValidation {
  readonly expression: FormulaExpression;
  readonly boundIds: readonly string[];
  readonly diagnostics: readonly FormulaDiagnostic[];
  readonly valid: boolean;
}

export interface FormulaDependencyRequest {
  readonly expression: FormulaExpression;
  readonly resolver?: FormulaResolverSnapshot;
  readonly limits?: Partial<FormulaLimits>;
}

export interface EvaluateFormulaRequest {
  readonly expression: FormulaExpression;
  readonly resolver: FormulaResolverSnapshot;
  readonly limits?: Partial<FormulaLimits>;
}

export interface FormulaEvaluation {
  readonly value: FormulaValue;
  readonly observedDependencies: readonly ObservedDependency[];
  readonly dependencyDigest: string;
  readonly evaluationDigest: string;
  readonly languageVersion: FormulaLanguageVersion;
  readonly evaluatorVersion: string;
  readonly steps: number;
}

export interface ExplainFormulaRequest {
  readonly expression: FormulaExpression;
  readonly resolver: FormulaResolverSnapshot;
  readonly limits?: Partial<FormulaLimits>;
}

export interface FormulaExplanation {
  readonly expression: FormulaExpression;
  readonly steps: string[];
}

export interface FormulaEngine {
  parse(request: ParseFormulaRequest): FormulaResult<FormulaExpression>;
  validate(request: ValidateFormulaRequest): FormulaResult<FormulaValidation>;
  dependencies(request: FormulaDependencyRequest): FormulaResult<FormulaDependencyResult>;
  evaluate(request: EvaluateFormulaRequest): FormulaResult<FormulaEvaluation>;
  explain(request: ExplainFormulaRequest): FormulaResult<FormulaExplanation>;
}

function mergeLimit<K extends keyof FormulaLimits>(
  base: FormulaLimits,
  override: Partial<FormulaLimits> | undefined,
  key: K
): FormulaLimits[K] {
  return override?.[key] ?? base[key];
}

function mergeLimits(base: FormulaLimits, override?: Partial<FormulaLimits>): FormulaLimits {
  if (!override) return base;
  return {
    maxSourceBytes: override.maxSourceBytes ?? base.maxSourceBytes,
    maxTokens: override.maxTokens ?? base.maxTokens,
    maxNodes: override.maxNodes ?? base.maxNodes,
    maxDepth: override.maxDepth ?? base.maxDepth,
    maxSteps: override.maxSteps ?? base.maxSteps,
    maxCallDepth: override.maxCallDepth ?? base.maxCallDepth,
    maxFields: override.maxFields ?? base.maxFields,
    maxRows: override.maxRows ?? base.maxRows,
    maxCells: override.maxCells ?? base.maxCells,
    maxOutputBytes: override.maxOutputBytes ?? base.maxOutputBytes,
    maxIntegerBits: override.maxIntegerBits ?? base.maxIntegerBits,
    maxPowerMagnitude: override.maxPowerMagnitude ?? base.maxPowerMagnitude,
    maxRoundingPlaces: override.maxRoundingPlaces ?? base.maxRoundingPlaces
  };
}

function digestSource(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex").slice(0, 32);
}

function digestEvaluation(value: FormulaValue, dependencyDigest: string): string {
  const payload = JSON.stringify(formulaValueIdentityPayload(value)) + "|" + dependencyDigest;
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function countValueCells(value: FormulaValue): number {
  if (value.kind !== "list" && value.kind !== "record" && value.kind !== "table") {
    return 0;
  }
  let count = 0;
  for (const row of value.table.rows) {
    count += row.length;
    for (const cell of row) count += countValueCells(cell);
  }
  return count;
}

function wireSizeBytes(value: FormulaValue): number {
  return Buffer.byteLength(JSON.stringify(formulaValueIdentityPayload(value)), "utf8");
}

class FormulaEngineImpl implements FormulaEngine {
  constructor(
    private readonly baseLimits: FormulaLimits,
    private readonly logger: Logger
  ) {}

  parse(request: ParseFormulaRequest): FormulaResult<FormulaExpression> {
    const start = performance.now();
    if (request.languageVersion !== "formula/v1") {
      const diag: FormulaDiagnostic = { code: "unsupported_version", message: `Unsupported language version: ${request.languageVersion}` };
      return failResult([diag]);
    }

    const limits = mergeLimits(this.baseLimits, request.limits);

    try {
      const tokens = lex(request.source);
      const result = parse(request.source, tokens, limits);
      const durationMs = Math.round(performance.now() - start);

      if (!result.ok) {
        this.logger.debug("formula.parse failed", { durationMs, diagnostics: result.diagnostics.length });
        return failResult(result.diagnostics);
      }

      const expression: FormulaExpression = {
        languageVersion: "formula/v1",
        source: request.source,
        sourceDigest: digestSource(request.source),
        root: result.node
      };

      this.logger.debug("formula.parse ok", { durationMs, nodeCount: countNodes(result.node) });
      return okResult(expression);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error("formula.parse unexpected error", { error: msg });
      return failResult([{ code: "parse_error", message: `Unexpected parse error: ${msg}` }]);
    }
  }

  validate(request: ValidateFormulaRequest): FormulaResult<FormulaValidation> {
    const start = performance.now();
    const limits = mergeLimits(this.baseLimits, request.limits);

    try {
      const snapshot = request.resolver ?? emptySnapshot();
      const bindResult = bind(request.expression.root, snapshot);
      const durationMs = Math.round(performance.now() - start);

      const valid = bindResult.diagnostics.length === 0;
      this.logger.debug("formula.validate", { durationMs, valid, diagnostics: bindResult.diagnostics.length });

      return okResult({
        expression: { ...request.expression, root: bindResult.root },
        boundIds: bindResult.boundIds,
        diagnostics: bindResult.diagnostics,
        valid
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error("formula.validate unexpected error", { error: msg });
      return failResult([{ code: "parse_error", message: `Unexpected validation error: ${msg}` }]);
    }
  }

  dependencies(request: FormulaDependencyRequest): FormulaResult<FormulaDependencyResult> {
    const start = performance.now();

    try {
      let root = request.expression.root;
      if (request.resolver) {
        const bindResult = bind(root, request.resolver);
        root = bindResult.root;
      }
      const deps = extractDependencies(root);
      const durationMs = Math.round(performance.now() - start);
      this.logger.debug("formula.dependencies", { durationMs, symbolic: deps.symbolic.length, bound: deps.bound.length });
      return okResult(deps);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error("formula.dependencies unexpected error", { error: msg });
      return failResult([{ code: "parse_error", message: `Unexpected dependency error: ${msg}` }]);
    }
  }

  evaluate(request: EvaluateFormulaRequest): FormulaResult<FormulaEvaluation> {
    const start = performance.now();
    const limits = mergeLimits(this.baseLimits, request.limits);

    try {
      // Bind first
      const bindResult = bind(request.expression.root, request.resolver);
      if (bindResult.diagnostics.length > 0) {
        return failResult(bindResult.diagnostics);
      }

      const output = evaluate(bindResult.root, request.resolver, limits);
      const durationMs = Math.round(performance.now() - start);

      if (output.diagnostics.length > 0) {
        this.logger.debug("formula.evaluate failed", { durationMs, steps: output.steps, diagnostics: output.diagnostics.length });
        return failResult(output.diagnostics);
      }

      const outputCells = countValueCells(output.value);
      if (outputCells > limits.maxCells) {
        const diagnostic = limitExceeded("maxCells", outputCells, limits.maxCells);
        this.logger.debug("formula.evaluate failed", {
          durationMs,
          steps: output.steps,
          diagnostics: 1,
          limit: "maxCells",
          actual: outputCells
        });
        return failResult([diagnostic]);
      }

      const outputBytes = wireSizeBytes(output.value);
      if (outputBytes > limits.maxOutputBytes) {
        const diagnostic = limitExceeded("maxOutputBytes", outputBytes, limits.maxOutputBytes);
        this.logger.debug("formula.evaluate failed", {
          durationMs,
          steps: output.steps,
          diagnostics: 1,
          limit: "maxOutputBytes",
          actual: outputBytes
        });
        return failResult([diagnostic]);
      }

      const deps = extractDependencies(bindResult.root);
      const evalDigest = digestEvaluation(output.value, deps.dependencyDigest);

      this.logger.debug("formula.evaluate ok", {
        durationMs,
        steps: output.steps,
        valueKind: output.value.kind,
        outputCells,
        outputBytes
      });

      return okResult({
        value: output.value,
        observedDependencies: output.observedDependencies,
        dependencyDigest: deps.dependencyDigest,
        evaluationDigest: evalDigest,
        languageVersion: "formula/v1",
        evaluatorVersion: EVALUATOR_VERSION,
        steps: output.steps
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error("formula.evaluate unexpected error", { error: msg });
      return failResult([{ code: "numeric_error", message: `Unexpected evaluation error: ${msg}` }]);
    }
  }

  explain(request: ExplainFormulaRequest): FormulaResult<FormulaExplanation> {
    // Bounded explanation: describe top-level AST operations
    const steps = describeNode(request.expression.root);
    return okResult({ expression: request.expression, steps });
  }
}

function emptySnapshot(): FormulaResolverSnapshot {
  return {
    id: "empty",
    scope: { userId: "", projectId: "" },
    bindings: new Map(),
    snapshotDigest: "empty",
    createdFrom: []
  };
}

function countNodes(node: FormulaNode): number {
  let count = 1;
  switch (node.type) {
    case "unary": count += countNodes(node.operand); break;
    case "binary": count += countNodes(node.left) + countNodes(node.right); break;
    case "call": count += countNodes(node.callee) + node.args.reduce((s, a) => s + countNodes(a), 0); break;
    case "lambda": count += countNodes(node.body); break;
    case "field-access": count += countNodes(node.target); break;
    case "index": count += countNodes(node.target) + countNodes(node.index); break;
    case "slice": count += countNodes(node.target); break;
    case "set-operation":
      count += countNodes(node.target);
      if (node.body.kind === "condition-query") count += countConditionNodes(node.body.condition);
      break;
    case "cardinality-promotion": count += countNodes(node.target); break;
    case "list-literal": count += node.elements.reduce((s, e) => s + countNodes(e), 0); break;
    case "record-literal": count += node.fields.reduce((s, f) => s + countNodes(f.value), 0); break;
  }
  return count;
}

function countConditionNodes(cond: import("./ast.js").FormulaConditionNode): number {
  switch (cond.type) {
    case "field-condition": return 1 + countNodes(cond.value);
    case "condition-not": return 1 + countConditionNodes(cond.condition);
    case "condition-composition": return 1 + cond.conditions.reduce((s, c) => s + countConditionNodes(c), 0);
  }
}

function describeNode(node: FormulaNode): string[] {
  switch (node.type) {
    case "null-literal": return ["null"];
    case "number-literal": return [`number(${node.raw})`];
    case "text-literal": return [`text("${node.value.slice(0, 40)}")`];
    case "logic-literal": return [`logic(${node.value})`];
    case "name": return [`name(${node.name})`];
    case "binary": return [`binary(${node.operator})`];
    case "unary": return [`unary(${node.operator})`];
    case "call": return node.callee.type === "name" ? [`call(${node.callee.name})`] : ["call"];
    case "lambda": return [`lambda(${node.parameters.join(", ")})`];
    case "field-access": return [...describeNode(node.target), `.${node.fieldName}`];
    case "index": return [...describeNode(node.target), "[index]"];
    case "slice": return [...describeNode(node.target), "[slice]"];
    case "set-operation": return [...describeNode(node.target), `.{${node.body.kind}}`];
    case "cardinality-promotion": return [...describeNode(node.target), node.mode === "exactly-one" ? "!" : "?"];
    default: return ["(expression)"];
  }
}

export function createFormulaEngine(limits: FormulaLimits, logger: Logger): FormulaEngine {
  return new FormulaEngineImpl(limits, logger);
}
