import ts from "typescript";

import { bindingNames, valueExports } from "../../shared/production.mjs";

const EFFECT_GLOBALS = new Set([
  "$effect",
  "alert",
  "cancelAnimationFrame",
  "clearInterval",
  "clearTimeout",
  "fetch",
  "onDestroy",
  "onMount",
  "queueMicrotask",
  "requestAnimationFrame",
  "setInterval",
  "setTimeout"
]);

const EXTERNAL_EFFECT_METHODS = new Set([
  "acquire",
  "apply",
  "attach",
  "close",
  "commit",
  "create",
  "createMany",
  "dispatch",
  "emit",
  "flush",
  "inspect",
  "open",
  "refresh",
  "release",
  "releaseAll",
  "removeFieldFromRows",
  "removeRows",
  "save",
  "schedule",
  "setItem",
  "singleFlight",
  "submit",
  "sync",
  "update",
  "write",
  "writeText"
]);

const VISIBLE_EFFECT_METHODS = new Set([
  "addEventListener",
  "appendChild",
  "blur",
  "click",
  "disconnect",
  "focus",
  "observe",
  "preventDefault",
  "removeAttribute",
  "removeChild",
  "removeEventListener",
  "scrollTo",
  "setAttribute",
  "stopPropagation"
]);

const MUTATING_METHODS = new Set([
  "add",
  "clear",
  "copyWithin",
  "delete",
  "fill",
  "pop",
  "push",
  "reverse",
  "set",
  "shift",
  "sort",
  "splice",
  "unshift"
]);

const OBSERVATIONAL_IMPORT = /^(?:can|find|get|has|is|list|lookup|query|read|select)/i;
const EFFECT_HOME = /^\$(?:capabilities|runtime)(?:\/|$)/;

const exported = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

const functionValue = (node) =>
  node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) ? node : undefined;

const functionsIn = (source) => {
  const found = new Map();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      found.set(statement.name.text, statement);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const value = functionValue(declaration.initializer);
      if (value) found.set(declaration.name.text, value);
    }
  }
  return found;
};

const exportedFunctionsIn = (source) => {
  const found = new Set();
  for (const statement of source.statements) {
    if (!exported(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      found.add(statement.name.text);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && functionValue(declaration.initializer)) {
        found.add(declaration.name.text);
      }
    }
  }
  return found;
};

const rootName = (node) => {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) current = current.expression;
  if (ts.isIdentifier(current)) return current.text;
  if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    return rootName(current.expression);
  }
  return undefined;
};

const localBindings = (body, parameters) => {
  const local = new Set(parameters);
  const visit = (node) => {
    if (ts.isVariableDeclaration(node)) {
      for (const name of bindingNames(node.name)) local.add(name);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
      local.add(node.name.text);
    }
    node.forEachChild(visit);
  };
  visit(body);
  return local;
};

const parameterBindings = (fn) => {
  const found = new Set();
  const visit = (node) => {
    if (ts.isFunctionLike(node)) {
      for (const parameter of node.parameters) {
        for (const name of bindingNames(parameter.name)) found.add(name);
      }
    }
    node.forEachChild(visit);
  };
  visit(fn);
  return found;
};

const effectImports = (source) => {
  const names = new Set();
  const namespaces = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!EFFECT_HOME.test(statement.moduleSpecifier.text)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    if (clause.name && !OBSERVATIONAL_IMPORT.test(clause.name.text)) names.add(clause.name.text);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      const imported = (element.propertyName ?? element.name).text;
      if (!OBSERVATIONAL_IMPORT.test(imported)) names.add(element.name.text);
    }
  }
  return { names, namespaces };
};

const isAssignment = (kind) =>
  kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

const directEffectsOf = (fn, functions, imports) => {
  const parameters = parameterBindings(fn);
  const locals = localBindings(fn.body, parameters);
  const calls = new Set();
  let effect = Boolean(fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword));

  const visit = (node) => {
    if (ts.isAwaitExpression(node)) effect = true;

    if (ts.isBinaryExpression(node) && isAssignment(node.operatorToken.kind)) {
      const root = rootName(node.left);
      if (root === undefined || parameters.has(root) || !locals.has(root)) effect = true;
    }

    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
    ) {
      const root = rootName(node.operand);
      if (root === undefined || parameters.has(root) || !locals.has(root)) effect = true;
    }

    if (ts.isDeleteExpression(node)) {
      const root = rootName(node.expression);
      if (root === undefined || parameters.has(root) || !locals.has(root)) effect = true;
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) {
        if (EFFECT_GLOBALS.has(callee.text) || parameters.has(callee.text) || imports.names.has(callee.text)) {
          effect = true;
        } else if (functions.has(callee.text) && !locals.has(callee.text)) {
          calls.add(callee.text);
        }
      }
      if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text;
        const root = rootName(callee.expression);
        const external =
          root !== undefined && (parameters.has(root) || imports.namespaces.has(root));
        if (
          root === "document" ||
          root === "localStorage" ||
          root === "navigator" ||
          root === "sessionStorage" ||
          root === "window" ||
          VISIBLE_EFFECT_METHODS.has(method) ||
          (external && !OBSERVATIONAL_IMPORT.test(method) && EXTERNAL_EFFECT_METHODS.has(method)) ||
          (MUTATING_METHODS.has(method) && root !== undefined && parameters.has(root)) ||
          (root !== undefined && parameters.has(root) && /^on[A-Z]/.test(method))
        ) effect = true;
      }
    }

    node.forEachChild(visit);
  };
  visit(fn.body);
  return { effect, calls };
};

export const procedureEntries = (tree, path) => {
  const source = tree.source(path);
  const entries = valueExports(tree, path).sort();
  const exportedFunctions = exportedFunctionsIn(source);
  const functions = functionsIn(source);
  const imports = effectImports(source);
  const analyses = new Map(
    [...functions].map(([name, fn]) => [name, directEffectsOf(fn, functions, imports)])
  );
  const effectful = new Set(
    [...analyses].filter(([, analysis]) => analysis.effect).map(([name]) => name)
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, analysis] of analyses) {
      if (effectful.has(name) || ![...analysis.calls].some((called) => effectful.has(called))) continue;
      effectful.add(name);
      changed = true;
    }
  }

  const effects = entries.filter((name) => exportedFunctions.has(name) && effectful.has(name));
  return { entries, effects, pure: entries.filter((name) => !effects.includes(name)) };
};
