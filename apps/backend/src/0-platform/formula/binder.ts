// Binder — walks an AST and enriches NameNodes with BoundFormulaReferences
// from a FormulaResolverSnapshot. Also validates stale bindings.

import type { FormulaNode, NameNode, BoundFormulaReference } from "./ast.js";
import type { FormulaResolverSnapshot } from "./resolver.js";
import type { FormulaDiagnostic } from "./diagnostics.js";
import { unknownIdentifier, staleBinding } from "./diagnostics.js";
import { normalizeKey } from "./resolver.js";
import { isBuiltinName } from "./builtins.js";

export interface BindResult {
  readonly root: FormulaNode;
  readonly diagnostics: FormulaDiagnostic[];
  readonly boundIds: readonly string[];  // binding IDs successfully resolved
}

type Env = ReadonlyMap<string, string>; // name → lambda param marker

function bindNode(
  node: FormulaNode,
  snapshot: FormulaResolverSnapshot,
  lambdaEnv: Env,
  diagnostics: FormulaDiagnostic[],
  boundIds: string[]
): FormulaNode {
  switch (node.type) {
    case "name": {
      const key = normalizeKey(node.name);
      // 1. Lambda parameter
      if (lambdaEnv.has(key)) return node;

      // 2. Formula built-ins are language names and cannot be shadowed by
      // project data. Structured Data rejects them at ingress as well, while
      // this ordering also protects snapshots created from older databases.
      if (isBuiltinName(node.name)) return node;

      // 3. A previously-bound node is identity-bound, not name-bound. Looking
      // it up by display name here would allow a rename followed by a new
      // declaration under the old name to silently retarget the expression.
      if (node.binding) {
        const binding = [...snapshot.bindings.values()].find(
          candidate => candidate.reference.bindingId === node.binding!.bindingId
        );
        if (
          !binding ||
          binding.ownerRevision !== node.binding.ownerRevision ||
          binding.valueDigest !== node.binding.valueDigest
        ) {
          diagnostics.push(staleBinding(node.binding.bindingId, node.span));
          return node;
        }
        boundIds.push(node.binding.bindingId);
        return node;
      }

      // 4. Resolver snapshot
      const binding = snapshot.bindings.get(key);
      if (binding) {
        const ref: BoundFormulaReference = {
          kind: "binding",
          bindingId: binding.reference.bindingId,
          ownerRevision: binding.ownerRevision,
          valueDigest: binding.valueDigest
        };
        boundIds.push(binding.reference.bindingId);
        return { ...node, binding: ref } satisfies NameNode;
      }
      // Unknown identifier
      diagnostics.push(unknownIdentifier(node.name, node.span));
      return node;
    }

    case "lambda": {
      const newEnv = new Map(lambdaEnv);
      for (const p of node.parameters) newEnv.set(normalizeKey(p), p);
      const body = bindNode(node.body, snapshot, newEnv, diagnostics, boundIds);
      return { ...node, body };
    }

    case "unary":
      return { ...node, operand: bindNode(node.operand, snapshot, lambdaEnv, diagnostics, boundIds) };

    case "binary":
      return {
        ...node,
        left: bindNode(node.left, snapshot, lambdaEnv, diagnostics, boundIds),
        right: bindNode(node.right, snapshot, lambdaEnv, diagnostics, boundIds)
      };

    case "call":
      return {
        ...node,
        callee: bindNode(node.callee, snapshot, lambdaEnv, diagnostics, boundIds),
        args: node.args.map(a => bindNode(a, snapshot, lambdaEnv, diagnostics, boundIds))
      };

    case "field-access":
      return { ...node, target: bindNode(node.target, snapshot, lambdaEnv, diagnostics, boundIds) };

    case "index":
      return {
        ...node,
        target: bindNode(node.target, snapshot, lambdaEnv, diagnostics, boundIds),
        index: bindNode(node.index, snapshot, lambdaEnv, diagnostics, boundIds)
      };

    case "slice":
      return { ...node, target: bindNode(node.target, snapshot, lambdaEnv, diagnostics, boundIds) };

    case "set-operation": {
      const target = bindNode(node.target, snapshot, lambdaEnv, diagnostics, boundIds);
      if (node.body.kind === "condition-query") {
        const condition = bindConditionNode(node.body.condition, snapshot, lambdaEnv, diagnostics, boundIds);
        return { ...node, target, body: { kind: "condition-query", condition } };
      }
      return { ...node, target };
    }

    case "cardinality-promotion":
      return { ...node, target: bindNode(node.target, snapshot, lambdaEnv, diagnostics, boundIds) };

    case "list-literal":
      return { ...node, elements: node.elements.map(e => bindNode(e, snapshot, lambdaEnv, diagnostics, boundIds)) };

    case "record-literal":
      return {
        ...node,
        fields: node.fields.map(f => ({ ...f, value: bindNode(f.value, snapshot, lambdaEnv, diagnostics, boundIds) }))
      };

    default:
      return node;
  }
}

function bindConditionNode(
  cond: import("./ast.js").FormulaConditionNode,
  snapshot: FormulaResolverSnapshot,
  lambdaEnv: Env,
  diagnostics: FormulaDiagnostic[],
  boundIds: string[]
): import("./ast.js").FormulaConditionNode {
  switch (cond.type) {
    case "field-condition":
      return { ...cond, value: bindNode(cond.value, snapshot, lambdaEnv, diagnostics, boundIds) };
    case "condition-not":
      return { ...cond, condition: bindConditionNode(cond.condition, snapshot, lambdaEnv, diagnostics, boundIds) };
    case "condition-composition":
      return { ...cond, conditions: cond.conditions.map(c => bindConditionNode(c, snapshot, lambdaEnv, diagnostics, boundIds)) };
  }
}

export function bind(
  root: FormulaNode,
  snapshot: FormulaResolverSnapshot
): BindResult {
  const diagnostics: FormulaDiagnostic[] = [];
  const boundIds: string[] = [];
  const bound = bindNode(root, snapshot, new Map(), diagnostics, boundIds);
  return { root: bound, diagnostics, boundIds };
}
