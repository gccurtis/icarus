/**
 * The two environment roots, and the names the graph is stood up by.
 *
 * One file per environment, so everything here is a lookup rather than a search:
 * a check that had to find the builder would be a check that reports nothing on
 * the day someone renamed it.
 */
import ts from "typescript";

export const ROOTS = {
  client: {
    start: ["runtime", "client", "start.ts"],
    types: ["runtime", "client", "types.ts"],
    builder: "buildClientModel",
    initializer: "initClientModel",
    accessor: "clientModel",
    aggregate: "ClientModel"
  },
  server: {
    start: ["runtime", "server", "start.server.ts"],
    types: ["runtime", "server", "types.ts"],
    builder: "buildServerModel",
    initializer: "initServerModel",
    accessor: "serverModel",
    closer: "closeServerModel",
    aggregate: "ServerModel"
  }
};

export const roots = (tree) =>
  Object.entries(ROOTS).map(([environment, shape]) => ({
    environment,
    ...shape,
    startPath: tree.path(...shape.start),
    typesPath: tree.path(...shape.types)
  }));

/** A top-level declaration by name, whatever kind it is. */
export const declarationNamed = (tree, path, wanted) => {
  for (const statement of tree.source(path).statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === wanted) return statement;
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === wanted) {
        return { statement, declaration };
      }
    }
  }
  return null;
};

/** The function body behind a name, whether it was declared or assigned. */
export const bodyOfDeclaration = (node) => {
  if (!node) return null;
  if (node.declaration) {
    const initializer = node.declaration.initializer;
    if (!initializer) return null;
    if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) return initializer.body;
    return null;
  }
  return node.body ?? null;
};

/** The object literal a builder returns, wherever in its body the return sits. */
export const returnedObject = (body) => {
  if (!body) return null;
  if (!ts.isBlock(body)) return ts.isObjectLiteralExpression(body) ? body : null;
  let found = null;
  const step = (node) => {
    if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
      found ??= node.expression;
    }
    node.forEachChild(step);
  };
  step(body);
  return found;
};

/** Property names an object literal assigns, in source order, duplicates kept. */
export const assignedFields = (literal) => {
  if (!literal) return [];
  const found = [];
  for (const property of literal.properties) {
    const name = property.name;
    if (!name) continue;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) found.push(name.text);
  }
  return found;
};

/** Members an interface declares. */
export const interfaceFields = (tree, path, wanted) => {
  for (const statement of tree.source(path).statements) {
    if (!ts.isInterfaceDeclaration(statement) || statement.name.text !== wanted) continue;
    return statement.members
      .map((member) => member.name)
      .filter(Boolean)
      .map((name) => name.getText(tree.source(path)));
  }
  return null;
};
