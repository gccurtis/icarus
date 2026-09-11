import { join, relative, sep } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import { callPath, isFunction, lineOf, visit } from "../shared/pure-contract.mjs";
import { isProductionPath, pureIslands } from "../shared/pure-islands.mjs";

const runeNames = new Set(["$state", "$derived", "$effect", "$props", "$bindable", "$inspect", "$host"]);

const ownerEffects = (island) => join(island.root, "effects");

const isWithin = (parent, path) => path === parent || path.startsWith(parent + sep);

const containsCall = (node) => {
  let found = false;
  visit(node, (child) => {
    if (ts.isCallExpression(child)) found = true;
  });
  return found;
};

const effectFunctions = (source) => {
  const found = [];
  visit(source, (node) => {
    if (!ts.isCallExpression(node) || callPath(node.expression)?.at(-1) !== "$effect") return;
    const callback = node.arguments[0];
    if (callback && isFunction(callback)) found.push(callback);
  });
  return found;
};

const hasCleanupReturn = (fn) => {
  let cleanup = false;
  const step = (node) => {
    if (node !== fn && isFunction(node)) return;
    if (ts.isReturnStatement(node) && node.expression && isFunction(node.expression)) cleanup = true;
    node.forEachChild(step);
  };
  step(fn);
  return cleanup;
};

export default check({
  name: "effects-are-boundaries",
  baseline: false,
  says: "Runes and lifecycle effects stay in explicit owner boundaries and delegate substantive decisions to pure procedures.",
  subjects: {
    location: "effects live in owner effects/ and never under procedures/",
    runes: "runes occur only in owner effects or minimal component markup",
    grammar: "effects contain registration, invocation, and cleanup rather than domain algorithms",
    decision: "effect conditionals delegate substantive predicates",
    cleanup: "long-lived handles are cleaned up by the effect that acquires them",
    lease: "staged model leases cannot survive one procedure invocation"
  },
  run(tree) {
    const found = [];
    const islands = pureIslands(tree).filter(({ kind }) => kind === "component-procedure");
    const roots = islands.map((island) => ({ island, effects: ownerEffects(island) }));

    for (const { island, effects } of roots) {
      const nested = join(island.entryRoot, "effects");
      for (const path of tree.under(nested)) {
        if (!isProductionPath(island.root, path)) continue;
        found.push({
          subject: "location",
          path,
          line: 1,
          fingerprint: `${island.id}:nested:${tree.rel(path)}`,
          message: "effect is inside procedures/effects; move it to the owner's sibling effects/ boundary"
        });
      }

      for (const path of tree.under(effects).filter((file) => file.endsWith(".ts") && isProductionPath(effects, file))) {
        const source = tree.source(path);
        for (const statement of source.statements) {
          if (!ts.isVariableStatement(statement)) continue;
          for (const declaration of statement.declarationList.declarations) {
            const text = `${declaration.name.getText(source)} ${declaration.type?.getText(source) ?? ""}`;
            if (!/(?:lease|acquired|staged).*port|port.*(?:lease|acquired|staged)/i.test(text)) continue;
            found.push({
              subject: "lease",
              path,
              line: lineOf(source, declaration),
              fingerprint: `${island.id}:held-lease:${declaration.name.getText(source)}`,
              message: "effect module retains an acquired/staged port beyond one invocation"
            });
          }
        }

        visit(source, (node) => {
          if (
            ts.isForStatement(node) ||
            ts.isForInStatement(node) ||
            ts.isForOfStatement(node) ||
            ts.isWhileStatement(node) ||
            ts.isDoStatement(node) ||
            ts.isSwitchStatement(node) ||
            ts.isTryStatement(node) ||
            (ts.isCallExpression(node) && ["map", "filter", "reduce", "flatMap", "sort"].includes(callPath(node.expression)?.at(-1))) ||
            (ts.isBinaryExpression(node) &&
              ts.isPropertyAccessExpression(node.left) &&
              node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
              node.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
          ) {
            found.push({
              subject: "grammar",
              path,
              line: lineOf(source, node),
              fingerprint: `${island.id}:grammar:${node.pos}:${ts.SyntaxKind[node.kind]}`,
              message: `effect contains substantive ${ts.SyntaxKind[node.kind]} behavior instead of delegating it`
            });
          }
          if (ts.isIfStatement(node) && !containsCall(node.expression)) {
            const text = node.thenStatement.getText(source);
            if (!/\b(?:cleanup|release|removeEventListener|clearTimeout|clearInterval|unsubscribe|abort)\b/i.test(text)) {
              found.push({
                subject: "decision",
                path,
                line: lineOf(source, node),
                fingerprint: `${island.id}:inline-decision:${node.pos}`,
                message: "effect makes an inline substantive decision instead of calling a named pure predicate"
              });
            }
          }
        });

        for (const fn of effectFunctions(source)) {
          const text = fn.getText(source);
          if (!/\b(?:addEventListener|setInterval|setTimeout|subscribe|acquire)\s*\(/.test(text) || hasCleanupReturn(fn)) continue;
          found.push({
            subject: "cleanup",
            path,
            line: lineOf(source, fn),
            fingerprint: `${island.id}:missing-cleanup:${fn.pos}`,
            message: "effect acquires a long-lived handle but returns no cleanup function"
          });
        }
      }
    }

    for (const path of tree.files.filter((file) => file.endsWith(".ts") && isProductionPath(tree.src, file))) {
      const source = tree.source(path);
      visit(source, (node) => {
        if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !runeNames.has(node.expression.text)) return;
        const owner = roots.find(({ island }) => isWithin(island.root, path));
        if (owner && isWithin(owner.effects, path)) return;
        found.push({
          subject: "runes",
          path,
          line: lineOf(source, node),
          fingerprint: `rune:${node.expression.text}:${node.pos}`,
          message: `${node.expression.text} occurs outside an owner effects/ boundary or component markup`
        });
      });
    }
    return found;
  }
});
