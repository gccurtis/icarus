/**
 * The key vocabulary, read back from the two files that hold it.
 *
 * A check computes what it expects itself rather than calling the generator: a
 * generator and a check that share a code path agree by construction, which is
 * exactly the agreement nobody needs proved.
 */
import ts from "typescript";

const BEHAVIOR = ["representation", "data", "behavior", "workspace"];

/** Generated from the workspace tree. */
export const KEYS_FILE = [...BEHAVIOR, "screens.ts"];
/** Hand-written: the panels this application intends to have. */
export const PANEL_KEYS_FILE = [...BEHAVIOR, "panels.ts"];

const arrayNamed = (tree, path, wanted) => {
  for (const statement of tree.source(path).statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== wanted) continue;
      let initializer = declaration.initializer;
      while (
        initializer &&
        (ts.isAsExpression(initializer) ||
          ts.isSatisfiesExpression?.(initializer) ||
          ts.isParenthesizedExpression(initializer))
      ) {
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

/** @returns {{ path: string, panelPath: string, contexts: string[]|null, inspections: string[]|null, screens: string[]|null, subscreens: Map<string,string[]>|null }} */
export const vocabulary = (tree) => {
  const path = tree.path(...KEYS_FILE);
  const panelPath = tree.path(...PANEL_KEYS_FILE);
  const inKeys = (name) => (tree.isFile(path) ? arrayNamed(tree, path, name) : null);
  const inPanelKeys = (name) => (tree.isFile(panelPath) ? arrayNamed(tree, panelPath, name) : null);

  return {
    path,
    panelPath,
    contexts: inPanelKeys("CONTEXT_IDS"),
    inspections: inPanelKeys("INSPECTION_KEYS"),
    screens: inKeys("SCREENS"),
    subscreens: tree.isFile(path) ? objectNamed(tree, path, "SUBSCREENS") : null
  };
};
