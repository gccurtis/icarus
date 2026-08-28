import ts from "typescript";

import { check } from "../shared/check.mjs";
import { capabilities } from "../shared/trees.mjs";

/**
 * A stub is a remote-function factory call. SvelteKit generates the client half
 * and the endpoint from it, and the wrapper holds nothing of its own.
 */
const FACTORIES = new Set(["query", "command", "form", "prerender"]);

const isStub = (statement) => {
  if (!ts.isVariableStatement(statement)) return false;
  return statement.declarationList.declarations.every((declaration) => {
    const initializer = declaration.initializer;
    if (!initializer || !ts.isCallExpression(initializer)) return false;
    const callee = initializer.expression;
    if (ts.isIdentifier(callee)) return FACTORIES.has(callee.text);
    if (ts.isPropertyAccessExpression(callee)) return FACTORIES.has(callee.name.text);
    return false;
  });
};

/**
 * What a statement is, in words. `ts.SyntaxKind` reverse-lookup is ambiguous —
 * several kinds share a number, so a variable statement reads as
 * "FirstStatement" — and a finding nobody can read is a finding nobody acts on.
 */
const describe = (statement) => {
  if (ts.isVariableStatement(statement)) return "a value";
  if (ts.isFunctionDeclaration(statement)) return "a function";
  if (ts.isClassDeclaration(statement)) return "a class";
  if (ts.isExpressionStatement(statement)) return "an expression";
  if (ts.isIfStatement(statement) || ts.isForStatement(statement) || ts.isWhileStatement(statement)) {
    return "control flow";
  }
  return "a statement";
};

const isDeclarationOnly = (statement) =>
  ts.isInterfaceDeclaration(statement) ||
  ts.isTypeAliasDeclaration(statement) ||
  ts.isImportDeclaration(statement) ||
  ts.isExportDeclaration(statement) ||
  ts.isExportAssignment(statement) ||
  statement.kind === ts.SyntaxKind.EndOfFileToken;

export default check({
  name: "door-holds-no-logic",
  says: "index.ts exports stubs and the types they speak in. It runs no statement of its own, so nothing bypasses the validated path.",
  run(tree) {
    const found = [];
    for (const { name, path } of capabilities(tree)) {
      const door = ["index.remote.ts", "index.ts"]
        .map((file) => `${path}/${file}`)
        .find((candidate) => tree.isFile(candidate));
      if (!door) continue;

      for (const statement of tree.source(door).statements) {
        if (isDeclarationOnly(statement) || isStub(statement)) continue;
        found.push({
          path: door,
          line: tree.lineOf(door, statement),
          message: `${name}'s door holds ${describe(statement)}, which is neither a stub nor a type`
        });
      }
    }
    return found;
  }
});
