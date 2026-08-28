/**
 * The generated key vocabulary, read back.
 *
 * The check computes the keys from the trees itself rather than calling the
 * generator: a generator and a check that share a code path agree by
 * construction, which is exactly the agreement nobody needs proved.
 */
import ts from "typescript";

export const KEYS_FILE = ["model", "client", "view-state", "methods", "shared", "keys.ts"];

const arrayNamed = (tree, path, wanted) => {
  for (const statement of tree.source(path).statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== wanted) continue;
      let initializer = declaration.initializer;
      while (initializer && (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer))) {
        initializer = initializer.expression;
      }
      if (initializer && ts.isArrayLiteralExpression(initializer)) {
        return initializer.elements.filter((node) => ts.isStringLiteral(node)).map((node) => node.text);
      }
    }
  }
  return null;
};

const objectNamed = (tree, path, wanted) => {
  for (const statement of tree.source(path).statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== wanted) continue;
      let initializer = declaration.initializer;
      while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression?.(initializer))) {
        initializer = initializer.expression;
      }
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) return null;
      const found = new Map();
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = ts.isStringLiteral(property.name) || ts.isIdentifier(property.name) ? property.name.text : null;
        if (!key || !ts.isArrayLiteralExpression(property.initializer)) continue;
        found.set(
          key,
          property.initializer.elements.filter((node) => ts.isStringLiteral(node)).map((node) => node.text)
        );
      }
      return found;
    }
  }
  return null;
};

/** @returns {{ path: string, contexts: string[]|null, inspections: string[]|null, screens: string[]|null, subscreens: Map<string,string[]>|null }} */
export const vocabulary = (tree) => {
  const path = tree.path(...KEYS_FILE);
  if (!tree.isFile(path)) {
    return { path, contexts: null, inspections: null, screens: null, subscreens: null };
  }
  return {
    path,
    contexts: arrayNamed(tree, path, "CONTEXT_IDS"),
    inspections: arrayNamed(tree, path, "INSPECTION_KEYS"),
    screens: arrayNamed(tree, path, "SCREENS"),
    subscreens: objectNamed(tree, path, "SUBSCREENS")
  };
};
