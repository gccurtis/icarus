import ts from "typescript";

import { check } from "../shared/check.mjs";
import { capabilities } from "../shared/trees.mjs";

/** A remote-function factory: SvelteKit generates the client half and the endpoint from it. */
const FACTORIES = new Set(["query", "command", "form", "prerender"]);

/** A procedure: a name bound to a remote function built from something in api/. */
const isProcedure = (statement) => {
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

/** A name brought in, passed through, or given to a shape. None of these define anything. */
const isName = (statement) =>
  ts.isImportDeclaration(statement) ||
  ts.isExportDeclaration(statement) ||
  ts.isExportAssignment(statement) ||
  ts.isInterfaceDeclaration(statement) ||
  ts.isTypeAliasDeclaration(statement) ||
  statement.kind === ts.SyntaxKind.EndOfFileToken;

const nameOf = (statement, source) => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations[0]?.name.getText(source) ?? "a value";
  }
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    return statement.name?.getText(source) ?? "a declaration";
  }
  return "a statement";
};

export default check({
  name: "capability-lists-its-procedures",
  says: "index.ts names what a capability offers. It imports each procedure, declares it, and names the types it speaks in. Nothing is defined here.",
  run(tree) {
    const found = [];
    for (const { path } of capabilities(tree)) {
      const index = ["index.remote.ts", "index.ts"]
        .map((file) => `${path}/${file}`)
        .find((candidate) => tree.isFile(candidate));
      if (!index) continue;

      const source = tree.source(index);
      for (const statement of source.statements) {
        if (isName(statement) || isProcedure(statement)) continue;
        found.push({
          path: index,
          line: tree.lineOf(index, statement),
          message: `defines ${nameOf(statement, source)} here; it belongs in api/`
        });
      }
    }
    return found;
  }
});
