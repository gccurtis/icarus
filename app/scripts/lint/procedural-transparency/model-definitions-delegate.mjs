import ts from "typescript";

import { check } from "../shared/check.mjs";

const isPublicMethod = (member) => {
  if (!ts.isMethodDeclaration(member) || !member.body) return false;
  const modifiers = ts.getModifiers(member) ?? [];
  return !modifiers.some(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.PrivateKeyword ||
      modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
      modifier.kind === ts.SyntaxKind.StaticKeyword
  );
};

const unwrap = (expression) => {
  let node = expression;
  while (
    ts.isAwaitExpression(node) ||
    ts.isVoidExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) node = node.expression;
  return node;
};

const delegates = (member, source, methodImports) => {
  const statements = member.body.statements;
  if (statements.length !== 1) return false;
  const [statement] = statements;
  const expression = ts.isExpressionStatement(statement)
    ? statement.expression
    : ts.isReturnStatement(statement)
      ? statement.expression
      : undefined;
  if (!expression) return false;
  const call = unwrap(expression);
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return false;
  const publicName = member.name?.getText(source);
  return call.expression.text === publicName && methodImports.has(call.expression.text);
};

export default check({
  id: "BEH-03",
  pillar: "procedural-transparency",
  finding: "ARCH-10",
  name: "model-definitions-delegate",
  says: "A model definition declares state and delegates each public action to one method entry.",
  run(tree) {
    const root = tree.path("model");
    const found = [];
    for (const path of tree.under(root).filter((file) => /\/definition(?:\.svelte)?\.ts$/.test(file))) {
      const source = tree.source(path);
      const methodImports = new Set(
        tree.imports(path)
          .filter((record) => /\$model\/(?:client|server)\/[^/]+\/methods\//.test(record.specifier))
          .flatMap((record) => record.names)
      );
      for (const statement of source.statements) {
        if (!ts.isClassDeclaration(statement)) continue;
        for (const member of statement.members) {
          if (!isPublicMethod(member) || delegates(member, source, methodImports)) continue;
          const name = member.name?.getText(source) ?? "anonymous";
          found.push({
            path,
            line: tree.lineOf(path, member),
            fingerprint: `${statement.name?.text ?? "class"}.${name}`,
            message: `${statement.name?.text ?? "class"}.${name} implements behavior in the definition instead of delegating to methods/`
          });
        }
      }
    }
    return found;
  }
});
