import ts from "typescript";

import { check } from "../shared/check.mjs";
import { bindingNames } from "../shared/production.mjs";
import { exportedFunctions, firstStatement, isCall } from "../shared/procedures.mjs";
import { procedureEntries } from "../shared/trees.mjs";

const gateBindings = (statement) => {
  if (!ts.isVariableStatement(statement)) return [];
  const [declaration] = statement.declarationList.declarations;
  if (!declaration?.initializer) return [];
  const text = declaration.initializer.getText();
  if (!/\brequireScope\s*\(/.test(text)) return [];
  return bindingNames(declaration.name);
};

const isDiscarded = (identifier) => {
  let node = identifier;
  while (
    ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node ||
    ts.isElementAccessExpression(node.parent) && node.parent.expression === node ||
    ts.isParenthesizedExpression(node.parent) ||
    ts.isAsExpression(node.parent) ||
    ts.isNonNullExpression(node.parent)
  ) node = node.parent;
  return (
    ts.isVoidExpression(node.parent) ||
    ts.isExpressionStatement(node.parent)
  );
};

const usagesOf = (body, names) => {
  const used = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) && names.includes(node.text) && !isDiscarded(node)) used.add(node.text);
    node.forEachChild(visit);
  };
  for (const statement of body.statements.slice(1)) visit(statement);
  return [...used];
};

export default check({
  id: "AUTH-02",
  pillar: "scoped-authority",
  finding: "ARCH-01",
  name: "capability-scope-is-consumed",
  says: "A capability does not merely call the gate; the resolved identity/project value participates in its decision or result.",
  run(tree) {
    const found = [];
    for (const path of procedureEntries(tree)) {
      const source = tree.source(path);
      for (const { body } of exportedFunctions(source)) {
        const first = firstStatement(body);
        if (!first || !isCall(first, "requireScope")) continue;
        const names = gateBindings(first);
        const used = usagesOf(body, names);
        if (names.length > 0 && used.length === names.length) continue;
        found.push({
          path,
          line: tree.lineOf(path, first),
          fingerprint: names.length === 0 ? "discarded-scope" : `unused:${names.filter((name) => !used.includes(name)).join(",")}`,
          message:
            names.length === 0
              ? "requireScope() is awaited and discarded, so it cannot constrain the operation"
              : `resolved scope binding is not consumed: ${names.filter((name) => !used.includes(name)).join(", ")}`
        });
      }
    }
    return found;
  }
});
