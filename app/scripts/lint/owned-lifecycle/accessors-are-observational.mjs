import ts from "typescript";

import { check } from "../shared/check.mjs";

const ACCESSOR = /^(?:get|read|find|lookup|of|for|[a-zA-Z]+Runtime)$/;
const EFFECTS = new Set([
  "attach",
  "acquire",
  "createRuntime",
  "release",
  "releaseAll",
  "schedule",
  "subscribe",
  "sync"
]);

const effectCalls = (body) => {
  const found = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : undefined;
      if (name && EFFECTS.has(name)) found.push(name);
    }
    node.forEachChild(visit);
  };
  visit(body);
  return [...new Set(found)].sort();
};

export default check({
  id: "LIFE-03",
  pillar: "owned-lifecycle",
  finding: "ARCH-03",
  name: "accessors-are-observational",
  says: "Accessor-shaped client model functions do not construct, subscribe, synchronize, acquire, or release state.",
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("model", "client")).filter((file) => file.endsWith(".ts"))) {
      const source = tree.source(path);
      const inspect = (name, body, node) => {
        if (!ACCESSOR.test(name)) return;
        const effects = effectCalls(body);
        if (effects.length === 0) return;
        found.push({
          path,
          line: tree.lineOf(path, node),
          fingerprint: `${name}:${effects.join(",")}`,
          message: `accessor ${name} performs lifecycle effects: ${effects.join(", ")}`
        });
      };
      for (const statement of source.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
          inspect(statement.name.text, statement.body, statement);
        }
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
            if (!ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer)) continue;
            inspect(declaration.name.text, declaration.initializer.body, declaration);
          }
        }
        if (!ts.isClassDeclaration(statement)) continue;
        for (const member of statement.members) {
          if (!ts.isMethodDeclaration(member) || !member.body || !member.name) continue;
          inspect(member.name.getText(source), member.body, member);
        }
      }
    }
    return found;
  }
});
