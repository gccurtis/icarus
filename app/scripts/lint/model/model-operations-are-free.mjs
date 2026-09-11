import { join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import { isProductionPath } from "../shared/pure-islands.mjs";
import { objects } from "../shared/trees.mjs";
import { repositoryProgram } from "../shared/typescript-program.mjs";

const exported = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );

const lineOf = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const exportedFunctions = (source) => {
  const found = [];
  for (const statement of source.statements) {
    if (!exported(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      found.push({ name: statement.name?.text ?? "default", node: statement });
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      if (!ts.isArrowFunction(declaration.initializer) && !ts.isFunctionExpression(declaration.initializer)) continue;
      found.push({ name: declaration.name.text, node: declaration.initializer });
    }
  }
  return found;
};

const stateSymbols = (compiler, statePath) => {
  const found = new Set();
  if (!compiler.program.getSourceFile(statePath)) return found;
  const source = compiler.source(statePath);
  for (const statement of source.statements) {
    if (
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      statement.name.text.endsWith("State")
    ) {
      const symbol = compiler.checker.getSymbolAtLocation(statement.name);
      if (symbol) found.add(symbol);
    }
  }
  return found;
};

const typeNamesState = (compiler, node, states) => {
  if (!node) return false;
  if (ts.isTypeReferenceNode(node)) {
    const symbol = compiler.symbolAt(node.typeName);
    if (symbol && states.has(symbol)) return true;
  }
  let found = false;
  node.forEachChild((child) => {
    if (typeNamesState(compiler, child, states)) found = true;
  });
  return found;
};

const forbiddenModelBoundary = (tree, root, path, specifier) => {
  const target = tree.resolve(specifier, path);
  if (!target || !tree.within(root, target)) return null;
  const relative = target.slice(root.length + 1).replaceAll("\\", "/");
  return /^(?:index(?:\.server)?\.ts|port\.ts|adapters\/|constructor\.ts|definition(?:\.svelte)?\.ts)/.test(relative)
    ? relative
    : null;
};

export default check({
  name: "model-operations-are-free",
  baseline: false,
  says: "Model operations are free functions and receive their model state in the first value position.",
  subjects: {
    "free-function": "model behavior is not attached to classes or object members",
    "state-first": "a stateful operation receives its model state as its first value parameter",
    "state-access": "methods cannot acquire, construct, or import a model lifecycle surface"
  },
  run(tree) {
    const compiler = repositoryProgram(tree);
    const found = [];
    for (const { id, path: root } of objects(tree)) {
      const methods = join(root, "methods");
      if (!tree.exists(methods)) continue;
      const states = stateSymbols(compiler, join(root, "state.ts"));
      for (const path of tree.under(methods)) {
        if (!path.endsWith(".ts") || !isProductionPath(methods, path)) continue;
        const source = compiler.source(path);

        for (const edge of tree.imports(path)) {
          const boundary = forbiddenModelBoundary(tree, root, path, edge.specifier);
          if (!boundary) continue;
          found.push({
            subject: "state-access",
            path,
            line: edge.line,
            fingerprint: `import:${edge.specifier}`,
            message: `${id} method imports ${boundary}; receive state/dependencies explicitly instead`
          });
        }

        for (const { name, node } of exportedFunctions(source)) {
          const statePositions = node.parameters
            .map((parameter, index) => typeNamesState(compiler, parameter.type, states) ? index : -1)
            .filter((index) => index >= 0);
          if (statePositions.length === 0 || statePositions[0] === 0) continue;
          found.push({
            subject: "state-first",
            path,
            line: lineOf(source, node.parameters[statePositions[0]]),
            fingerprint: `${name}:state-at:${statePositions[0]}`,
            message: `${name} receives model state at position ${statePositions[0] + 1}; state must be first`
          });
        }

        const visit = (node) => {
          if (
            ts.isClassDeclaration(node) ||
            ts.isClassExpression(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isGetAccessorDeclaration(node) ||
            ts.isSetAccessorDeclaration(node)
          ) {
            found.push({
              subject: "free-function",
              path,
              line: lineOf(source, node),
              fingerprint: ts.SyntaxKind[node.kind],
              message: `${id} methods contain attached ${ts.SyntaxKind[node.kind]} behavior`
            });
          }
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            /^create[A-Z].*State$/.test(node.expression.text)
          ) {
            found.push({
              subject: "state-access",
              path,
              line: lineOf(source, node),
              fingerprint: `construct:${node.expression.text}`,
              message: `${node.expression.text} constructs model state from inside its method island`
            });
          }
          node.forEachChild(visit);
        };
        source.forEachChild(visit);
      }
    }
    return found;
  }
});
