import ts from "typescript";

import { check } from "../shared/check.mjs";
import { capabilities } from "../shared/trees.mjs";

/**
 * What a validation call is called. The generator writes one of these into every
 * new procedure, so the convention and the check come from the same place — a
 * procedure that reads as validating and is not is the failure this exists to
 * catch, and a name is the only thing a linter can read.
 */
const VALIDATORS = /^(parse|validate|assert|require|check)[A-Z]?/;
const METHODS = new Set(["parse", "safeParse", "validate", "assert"]);

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
const expressionOf = (statement) => {
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

const isValidation = (statement) => {
  const expression = expressionOf(statement);
  if (!expression) return false;
  const call = unwrap(expression);
  if (!ts.isCallExpression(call)) return false;
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return VALIDATORS.test(callee.text);
  if (ts.isPropertyAccessExpression(callee)) return METHODS.has(callee.name.text);
  return false;
};

/** The first statement that does something, past whatever the body declared to itself. */
const firstAction = (body) => {
  for (const statement of body.statements ?? []) {
    if (ts.isEmptyStatement(statement)) continue;
    return statement;
  }
  return null;
};

const bodyOf = (statement) => {
  if (ts.isFunctionDeclaration(statement)) return statement.body ?? null;
  if (!ts.isVariableStatement(statement)) return null;
  for (const declaration of statement.declarationList.declarations) {
    const initializer = declaration.initializer;
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return ts.isBlock(initializer.body) ? initializer.body : null;
    }
  }
  return null;
};

/** Every `api/<procedure>/…/<entry>.ts` — a directory's entry is named for it. */
const entries = (tree, capability, dir, found = []) => {
  for (const name of tree.dirsIn(dir)) {
    if (name === "shared") continue;
    const child = `${dir}/${name}`;
    const entry = `${child}/${name}.ts`;
    if (tree.isFile(entry)) found.push({ capability, entry });
    entries(tree, capability, child, found);
  }
  return found;
};

export default check({
  name: "procedure-validates-first",
  says: "Every api/<procedure> entry validates its argument before its first other statement.",
  run(tree) {
    const found = [];
    for (const { name, path } of capabilities(tree)) {
      const api = `${path}/api`;
      if (!tree.exists(api)) continue;

      for (const { entry } of entries(tree, name, api)) {
        const exported = tree
          .source(entry)
          .statements.filter(
            (statement) =>
              ts.canHaveModifiers(statement) &&
              (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
          );

        const bodies = exported.map(bodyOf).filter(Boolean);
        if (bodies.length === 0) {
          found.push({ path: entry, message: "exports no function, so there is nothing to validate" });
          continue;
        }

        for (const body of bodies) {
          const first = firstAction(body);
          if (first && isValidation(first)) continue;
          found.push({
            path: entry,
            line: first ? tree.lineOf(entry, first) : 1,
            message: first
              ? "the first statement is not a validation call"
              : "the entry does nothing, so it cannot have validated"
          });
        }
      }
    }
    return found;
  }
});
