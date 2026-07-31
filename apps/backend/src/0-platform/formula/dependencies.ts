// Dependency extraction — symbolic, bound, and observed.

import type { FormulaNode, FormulaConditionNode, BoundFormulaReference } from "./ast.js";
import type { SourceSpan } from "./tokens.js";
import { createHash } from "node:crypto";

export interface SymbolicDependency {
  readonly name: string;
  readonly span: SourceSpan;
}

export interface ObservedDependency {
  readonly reference: BoundFormulaReference;
  readonly ownerRevision: number | string;
  readonly valueDigest: string;
  readonly access:
    | { readonly kind: "value" }
    | { readonly kind: "field"; readonly fieldName: string }
    | { readonly kind: "index"; readonly index: number }
    | { readonly kind: "slice"; readonly start?: number; readonly end?: number }
    | { readonly kind: "set-operation"; readonly expressionDigest: string };
}

export interface FormulaDependencyResult {
  readonly symbolic: readonly SymbolicDependency[];
  readonly bound: readonly BoundFormulaReference[];
  readonly observed?: readonly ObservedDependency[];
  readonly dependencyDigest: string;
}

function collectSymbolic(node: FormulaNode, results: SymbolicDependency[]): void {
  switch (node.type) {
    case "name":
      if (!node.binding) results.push({ name: node.name, span: node.span });
      return;
    case "unary": collectSymbolic(node.operand, results); return;
    case "binary":
      collectSymbolic(node.left, results);
      collectSymbolic(node.right, results);
      return;
    case "call":
      collectSymbolic(node.callee, results);
      node.args.forEach(a => collectSymbolic(a, results));
      return;
    case "lambda": collectSymbolic(node.body, results); return;
    case "field-access": collectSymbolic(node.target, results); return;
    case "index":
      collectSymbolic(node.target, results);
      collectSymbolic(node.index, results);
      return;
    case "slice": collectSymbolic(node.target, results); return;
    case "set-operation":
      collectSymbolic(node.target, results);
      if (node.body.kind === "condition-query") {
        collectSymbolicFromCondition(node.body.condition, results);
      }
      return;
    case "cardinality-promotion": collectSymbolic(node.target, results); return;
    case "list-literal": node.elements.forEach(e => collectSymbolic(e, results)); return;
    case "record-literal": node.fields.forEach(f => collectSymbolic(f.value, results)); return;
    default: return;
  }
}

function collectSymbolicFromCondition(cond: FormulaConditionNode, results: SymbolicDependency[]): void {
  switch (cond.type) {
    case "field-condition": collectSymbolic(cond.value, results); return;
    case "condition-not": collectSymbolicFromCondition(cond.condition, results); return;
    case "condition-composition": cond.conditions.forEach(c => collectSymbolicFromCondition(c, results)); return;
  }
}

function collectBound(node: FormulaNode, results: BoundFormulaReference[]): void {
  switch (node.type) {
    case "name":
      if (node.binding) results.push(node.binding);
      return;
    case "unary": collectBound(node.operand, results); return;
    case "binary":
      collectBound(node.left, results);
      collectBound(node.right, results);
      return;
    case "call":
      collectBound(node.callee, results);
      node.args.forEach(a => collectBound(a, results));
      return;
    case "lambda": collectBound(node.body, results); return;
    case "field-access": collectBound(node.target, results); return;
    case "index":
      collectBound(node.target, results);
      collectBound(node.index, results);
      return;
    case "slice": collectBound(node.target, results); return;
    case "set-operation":
      collectBound(node.target, results);
      if (node.body.kind === "condition-query") {
        collectBoundFromCondition(node.body.condition, results);
      }
      return;
    case "cardinality-promotion": collectBound(node.target, results); return;
    case "list-literal": node.elements.forEach(e => collectBound(e, results)); return;
    case "record-literal": node.fields.forEach(f => collectBound(f.value, results)); return;
    default: return;
  }
}

function collectBoundFromCondition(cond: FormulaConditionNode, results: BoundFormulaReference[]): void {
  switch (cond.type) {
    case "field-condition": collectBound(cond.value, results); return;
    case "condition-not": collectBoundFromCondition(cond.condition, results); return;
    case "condition-composition": cond.conditions.forEach(c => collectBoundFromCondition(c, results)); return;
  }
}

function digestDependencies(bound: BoundFormulaReference[]): string {
  const sorted = [...bound].sort((a, b) => a.bindingId.localeCompare(b.bindingId));
  const payload = sorted.map(b => `${b.bindingId}:${b.ownerRevision}:${b.valueDigest}`).join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function extractDependencies(root: FormulaNode): FormulaDependencyResult {
  const symbolic: SymbolicDependency[] = [];
  const bound: BoundFormulaReference[] = [];
  collectSymbolic(root, symbolic);
  collectBound(root, bound);
  // Deduplicate bound by bindingId
  const seen = new Set<string>();
  const uniqueBound = bound.filter(b => {
    if (seen.has(b.bindingId)) return false;
    seen.add(b.bindingId);
    return true;
  });
  return {
    symbolic,
    bound: uniqueBound,
    dependencyDigest: digestDependencies(uniqueBound)
  };
}
