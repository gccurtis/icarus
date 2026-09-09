import ts from "typescript";

import { procedureEntries } from "./trees.mjs";

const MUTATORS = new Set(["create", "update", "remove", "replace"]);
const UNITS = new Set(["transaction", "unitOfWork"]);

const isStoreReceiver = (expression) => {
  if (ts.isIdentifier(expression)) return expression.text === "store";
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text === "store";
  return false;
};

const calledName = (call) => {
  const callee = call.expression;
  return ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : undefined;
};

const functionBody = (initializer) =>
  ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)
    ? initializer.body
    : undefined;

const functionsIn = (tree, path) => {
  const found = new Map();
  for (const statement of tree.source(path).statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      found.set(statement.name.text, statement.body);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const body = functionBody(declaration.initializer);
      if (body) found.set(declaration.name.text, body);
    }
  }
  return found;
};

const exportedFunctionNames = (tree, path) => {
  const found = [];
  for (const statement of tree.source(path).statements) {
    const exported = (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    );
    if (!exported) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      found.push(statement.name.text);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        functionBody(declaration.initializer)
      ) found.push(declaration.name.text);
    }
  }
  return found;
};

const importsIn = (tree, path) => {
  const found = new Map();
  for (const statement of tree.source(path).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const target = tree.resolve(statement.moduleSpecifier.text, path);
    const clause = statement.importClause;
    if (!target || !clause || clause.isTypeOnly) continue;
    if (clause.name) found.set(clause.name.text, { path: target, name: "default" });
    const bindings = clause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      found.set(element.name.text, {
        path: target,
        name: (element.propertyName ?? element.name).text
      });
    }
  }
  return found;
};

const apiRootOf = (path) => {
  const normalized = path.replaceAll("\\", "/");
  const marker = "/api/";
  const at = normalized.indexOf(marker);
  return at < 0 ? undefined : normalized.slice(0, at + marker.length - 1);
};

const withinApi = (apiRoot, path) => {
  if (!apiRoot || !path) return false;
  const normalized = path.replaceAll("\\", "/");
  return normalized === apiRoot || normalized.startsWith(`${apiRoot}/`);
};

const callable = (node) =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node);

/** Direct writes are retained for simple rules and diagnostic tooling. */
export const durableMutationsIn = (tree, path) => {
  const found = [];
  tree.eachNode(path, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (!MUTATORS.has(node.expression.name.text)) return;
    if (!isStoreReceiver(node.expression.expression)) return;
    found.push({
      method: node.expression.name.text,
      path,
      line: tree.lineOf(path, node),
      node,
      atomic: false,
      callPath: [tree.rel(path)]
    });
  });
  return found;
};

/**
 * Durable effects reachable from one capability entry.
 *
 * Calls to local/imported helpers beneath the same capability `api/` tree are
 * followed by binding rather than by filename. Transaction context travels
 * into callbacks and through helper calls, so extracting a write cannot hide
 * it and extracting an already-atomic operation does not create a false alarm.
 */
export const reachableDurableMutations = (tree, entry) => {
  const apiRoot = apiRootOf(entry);
  const mutations = [];
  const functions = new Map();
  const imports = new Map();
  const definitions = (path) => {
    if (!functions.has(path)) functions.set(path, functionsIn(tree, path));
    return functions.get(path);
  };
  const bindings = (path) => {
    if (!imports.has(path)) imports.set(path, importsIn(tree, path));
    return imports.get(path);
  };

  const run = (path, name, atomic, stack, callPath) => {
    if (!tree.isFile(path) || !withinApi(apiRoot, path)) return;
    const body = definitions(path).get(name);
    if (!body) return;
    const key = `${path}:${name}:${atomic ? "atomic" : "plain"}`;
    if (stack.has(key)) return;
    const nextStack = new Set(stack).add(key);

    const visit = (node, enclosed) => {
      if (ts.isCallExpression(node)) {
        const nameOfCall = calledName(node);
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          MUTATORS.has(node.expression.name.text) &&
          isStoreReceiver(node.expression.expression)
        ) {
          mutations.push({
            method: node.expression.name.text,
            path,
            line: tree.lineOf(path, node),
            node,
            atomic: enclosed,
            callPath
          });
        }

        if (nameOfCall && UNITS.has(nameOfCall)) {
          for (const argument of node.arguments) {
            if (callable(argument)) {
              if (argument.body) visit(argument.body, true);
            } else {
              visit(argument, enclosed);
            }
          }
          return;
        }

        if (ts.isIdentifier(node.expression)) {
          if (definitions(path).has(node.expression.text)) {
            run(path, node.expression.text, enclosed, nextStack, [...callPath, node.expression.text]);
          } else {
            const imported = bindings(path).get(node.expression.text);
            if (imported && withinApi(apiRoot, imported.path)) {
              run(
                imported.path,
                imported.name,
                enclosed,
                nextStack,
                [...callPath, `${tree.rel(imported.path)}#${imported.name}`]
              );
            }
          }
        }

        for (const argument of node.arguments) {
          if (callable(argument)) {
            if (argument.body) visit(argument.body, enclosed);
          } else {
            visit(argument, enclosed);
          }
        }
        return;
      }
      if (callable(node)) return;
      node.forEachChild((child) => visit(child, enclosed));
    };

    visit(body, atomic);
  };

  for (const name of exportedFunctionNames(tree, entry)) {
    run(entry, name, false, new Set(), [`${tree.rel(entry)}#${name}`]);
  }
  return mutations;
};

export const multiWriteEntries = (tree) =>
  procedureEntries(tree)
    .map((path) => ({ path, mutations: reachableDurableMutations(tree, path) }))
    .filter(({ mutations }) => mutations.length > 1);
