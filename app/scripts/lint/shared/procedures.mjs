/**
 * What the two checks over `api/<procedure>` both read.
 *
 * They ask different questions of the same statements — one that the gate runs
 * first, one that the input is checked before anything acts on it — and a second
 * copy of "which statement is first" is how the two would come to disagree.
 */
import ts from "typescript";

/** The one function that establishes a scope. `scope.server.ts` exports it. */
export const GATE = "requireScope";

const unwrap = (node) => {
  let at = node;
  for (;;) {
    if (ts.isAwaitExpression(at) || ts.isNonNullExpression(at) || ts.isParenthesizedExpression(at)) {
      at = at.expression;
      continue;
    }
    if (ts.isAsExpression(at)) {
      at = at.expression;
      continue;
    }
    return at;
  }
};

/** The expression a statement is, whether it stands alone, is returned, or is bound. */
export const expressionOf = (statement) => {
  if (ts.isExpressionStatement(statement)) return statement.expression;
  if (ts.isReturnStatement(statement)) return statement.expression ?? null;
  if (ts.isThrowStatement(statement)) return statement.expression;
  if (ts.isIfStatement(statement)) return statement.expression;
  if (ts.isVariableStatement(statement)) {
    const [declaration] = statement.declarationList.declarations;
    return declaration?.initializer ?? null;
  }
  return statement;
};

export const calleeOf = (statement) => {
  const expression = expressionOf(statement);
  if (!expression) return null;
  const call = unwrap(expression);
  return ts.isCallExpression(call) ? call.expression : null;
};

/** Whether a statement is a call to `name`. */
export const isCall = (statement, name) => {
  const callee = calleeOf(statement);
  return Boolean(callee) && ts.isIdentifier(callee) && callee.text === name;
};

/** The first statement that does something. */
export const firstStatement = (body, skip = 0) => {
  const statements = (body.statements ?? []).filter((s) => !ts.isEmptyStatement(s));
  return statements[skip] ?? null;
};

/** Every exported function in a procedure entry, with the parameters it declares. */
export const exportedFunctions = (source) => {
  const found = [];
  for (const statement of source.statements) {
    const exported =
      ts.canHaveModifiers(statement) &&
      (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;

    if (ts.isFunctionDeclaration(statement) && statement.body) {
      found.push({ body: statement.body, parameters: statement.parameters });
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (!initializer) continue;
      if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) continue;
      if (!ts.isBlock(initializer.body)) continue;
      found.push({ body: initializer.body, parameters: initializer.parameters });
    }
  }
  return found;
};
