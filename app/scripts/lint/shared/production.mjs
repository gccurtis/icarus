import ts from "typescript";

import { homeOf, TEST } from "./home.mjs";

const SOURCE = /\.(?:ts|js|svelte)$/;

export const isDevelopment = (tree, path) =>
  tree.within(tree.path("development-views"), path) ||
  tree.rel(path).startsWith("src/routes/demo/") ||
  tree.rel(path).includes("/test/");

export const productionSources = (tree) =>
  tree.files.filter((path) => {
    if (!SOURCE.test(path) || path.endsWith(".d.ts")) return false;
    if (isDevelopment(tree, path)) return false;
    return homeOf(tree, path).home !== TEST;
  });

export const productionSvelte = (tree) =>
  productionSources(tree).filter((path) => path.endsWith(".svelte"));

export const valueExports = (tree, path) => {
  const found = [];
  for (const statement of tree.source(path).statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) ?? [] : [];
    if (!modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name) found.push(statement.name.text);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) found.push(declaration.name.text);
    }
  }
  return found;
};

export const callsNamed = (source, names) => {
  const found = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : undefined;
      if (name && names.has(name)) found.push({ name, node });
    }
    node.forEachChild(visit);
  };
  visit(source);
  return found;
};

export const bindingNames = (name) => {
  if (ts.isIdentifier(name)) return [name.text];
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    return name.elements.flatMap((element) =>
      ts.isBindingElement(element) ? bindingNames(element.name) : []
    );
  }
  return [];
};
