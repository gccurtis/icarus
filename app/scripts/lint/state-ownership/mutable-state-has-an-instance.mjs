import ts from "typescript";

import { check } from "../shared/check.mjs";
import { constructionsAtLoad, mutableBindings } from "../shared/module-load.mjs";
import { productionSources } from "../shared/production.mjs";

const APPROVED_HOLDERS = new Set([
  "src/lib/runtime/client/start.ts",
  "src/lib/runtime/server/start.server.ts"
]);
const VALUE_OBJECTS = new Set(["new PluginKey", "new Schema"]);
const READ_ONLY_SET_MEMBERS = new Set(["entries", "forEach", "has", "keys", "size", "values"]);

const isExported = (statement) =>
  (ts.getModifiers(statement) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );

const moduleRuneState = (tree, path) => {
  const found = [];
  tree.eachImmediate(path, (node) => {
    if (!ts.isCallExpression(node)) return;
    const callee = node.expression;
    const rune =
      ts.isIdentifier(callee) && callee.text === "$state" ||
      ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "$state";
    if (!rune) return;
    let parent = node.parent;
    while (parent && !ts.isVariableDeclaration(parent)) parent = parent.parent;
    if (!parent || !ts.isVariableDeclarationList(parent.parent)) return;
    if (!(parent.parent.flags & ts.NodeFlags.Const)) return;
    found.push({ name: parent.name.getText(tree.source(path)), line: tree.lineOf(path, node) });
  });
  return found;
};

/**
 * A private `const FLAGS = new Set([...])` used only as a lookup table is data,
 * not a process-wide state owner. The exemption is deliberately syntactic: an
 * export, mutation, escape, or unrecognised use turns it back into a finding.
 */
const immutableLookupSetLines = (tree, path) => {
  const source = tree.source(path);
  const candidates = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || isExported(statement)) continue;
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        !declaration.initializer ||
        !ts.isNewExpression(declaration.initializer) ||
        !ts.isIdentifier(declaration.initializer.expression) ||
        declaration.initializer.expression.text !== "Set"
      ) continue;
      candidates.set(declaration.name.text, {
        declaration,
        line: tree.lineOf(path, declaration.initializer),
        safe: true
      });
    }
  }
  if (candidates.size === 0) return new Set();

  tree.eachNode(path, (node) => {
    if (!ts.isIdentifier(node)) return;
    const candidate = candidates.get(node.text);
    if (!candidate || node === candidate.declaration.name) return;
    const parent = node.parent;
    const readMember =
      ts.isPropertyAccessExpression(parent) &&
      parent.expression === node &&
      READ_ONLY_SET_MEMBERS.has(parent.name.text);
    const iterated = ts.isForOfStatement(parent) && parent.expression === node;
    const spread = ts.isSpreadElement(parent) && parent.expression === node;
    if (!readMember && !iterated && !spread) candidate.safe = false;
  });

  return new Set(
    [...candidates.values()].filter(({ safe }) => safe).map(({ line }) => line)
  );
};

export default check({
  id: "OWN-01",
  pillar: "state-ownership",
  finding: "ARCH-11",
  name: "mutable-state-has-an-instance",
  says: "Mutable production state is owned by an instance, never by an incidental imported module.",
  run(tree) {
    const found = [];
    for (const path of productionSources(tree)) {
      if (path.endsWith(".svelte") || APPROVED_HOLDERS.has(tree.rel(path))) continue;
      for (const binding of mutableBindings(tree, path)) {
        found.push({
          path,
          line: binding.line,
          fingerprint: binding.name,
          message: `${binding.keyword} ${binding.name} is shared by every importer instead of one explicit owner instance`
        });
      }
      for (const binding of moduleRuneState(tree, path)) {
        found.push({
          path,
          line: binding.line,
          fingerprint: `rune:${binding.name}`,
          message: `const ${binding.name} creates module-lifetime reactive state instead of instance-owned state`
        });
      }
      const lookupSetLines = immutableLookupSetLines(tree, path);
      const constructions = constructionsAtLoad(tree, path).filter(
        ({ name, line }) =>
          !VALUE_OBJECTS.has(name) && !(name === "new Set" && lookupSetLines.has(line))
      );
      if (constructions.length > 0) {
        found.push({
          path,
          line: constructions[0].line,
          fingerprint: `construction:${constructions.map(({ name }) => name).sort().join(",")}`,
          message:
            `module-load construction (${constructions.map(({ name }) => name).join(", ")}) ` +
            "creates one shared mutable instance for every importer"
        });
      }
    }
    return found;
  }
});
