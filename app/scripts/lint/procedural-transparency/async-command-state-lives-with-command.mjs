import { createHash } from "node:crypto";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import { productionSvelte } from "../shared/production.mjs";

const asyncModifier = (node) =>
  (ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
  );

const hasAwait = (node) => {
  let found = false;
  const visit = (child) => {
    if (ts.isAwaitExpression(child)) found = true;
    if (!found) child.forEachChild(visit);
  };
  visit(node);
  return found;
};

const oneDelegatingStatement = (body) => {
  if (!ts.isBlock(body)) return ts.isCallExpression(body);
  if (body.statements.length !== 1) return false;
  const [statement] = body.statements;
  const expression = ts.isReturnStatement(statement)
    ? statement.expression
    : ts.isExpressionStatement(statement)
      ? statement.expression
      : undefined;
  if (!expression) return false;
  if (ts.isAwaitExpression(expression)) return ts.isCallExpression(expression.expression);
  return ts.isCallExpression(expression);
};

const fingerprintOf = (name, node, source) => {
  const normalized = node.getText(source).replace(/\s+/g, " ").trim();
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `${name}:${digest}`;
};

export default check({
  id: "BEH-05",
  pillar: "procedural-transparency",
  finding: "ARCH-09",
  name: "async-command-state-lives-with-command",
  says: "A component may await one named procedure, but it may not implement an asynchronous command chain beside markup.",
  run(tree) {
    const found = [];
    for (const path of productionSvelte(tree)) {
      for (const script of tree.scripts(path)) {
        const visit = (node) => {
          const callable =
            ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node) ||
            ts.isMethodDeclaration(node);
          if (
            callable &&
            node.body &&
            asyncModifier(node) &&
            hasAwait(node.body) &&
            !oneDelegatingStatement(node.body)
          ) {
            const name = node.name?.getText(script.source) ?? "inline async handler";
            found.push({
              path,
              line: tree.scriptLine(path, script, node),
              fingerprint: fingerprintOf(name, node, script.source),
              message: `${name} implements a multi-step asynchronous command in the component`
            });
          }
          node.forEachChild(visit);
        };
        visit(script.source);
      }
      if (/on[a-z]+\s*=\s*\{\s*async\b/.test(tree.read(path))) {
        found.push({
          path,
          fingerprint: "inline-markup-async-handler",
          message: "markup declares an inline async handler instead of calling a named procedure"
        });
      }
    }
    return found;
  }
});
