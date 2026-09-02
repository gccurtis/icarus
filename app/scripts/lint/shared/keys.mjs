/**
 * The key vocabulary, read back from the two files that hold it.
 *
 * A check computes what it expects itself rather than calling the generator: a
 * generator and a check that share a code path agree by construction, which is
 * exactly the agreement nobody needs proved.
 */
import ts from "typescript";

const BEHAVIOR = ["representation", "data", "behavior", "workspace"];

/** Generated from the category tree. */
export const KEYS_FILE = [...BEHAVIOR, "categories.ts"];
/** Hand-written: the views this application intends to have. */
export const VIEW_KEYS_FILE = [...BEHAVIOR, "views.ts"];

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

/** @returns {{ path: string, viewPath: string, contexts: string[]|null, inspections: string[]|null, categories: string[]|null, contentViews: string[]|null }} */
export const vocabulary = (tree) => {
  const path = tree.path(...KEYS_FILE);
  const viewPath = tree.path(...VIEW_KEYS_FILE);
  const inKeys = (name) => (tree.isFile(path) ? arrayNamed(tree, path, name) : null);
  const inViewKeys = (name) => (tree.isFile(viewPath) ? arrayNamed(tree, viewPath, name) : null);

  return {
    path,
    viewPath,
    contexts: inViewKeys("CONTEXT_VIEWS"),
    inspections: inViewKeys("INSPECTOR_VIEWS"),
    categories: inKeys("CATEGORIES"),
    contentViews: inKeys("CONTENT_VIEWS")
  };
};
