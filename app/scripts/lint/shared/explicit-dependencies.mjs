import ts from "typescript";

import { bindingNames } from "./production.mjs";

const AMBIENT = new Map([
  ["performance", "the clock"],
  ["process", "the process environment"],
  ["globalThis", "global state"],
  ["window", "the browser window"],
  ["document", "the browser document"],
  ["navigator", "the browser environment"],
  ["localStorage", "browser storage"],
  ["sessionStorage", "browser storage"],
  ["crypto", "ambient randomness"],
  ["fetch", "the network"],
  ["alert", "the browser UI"],
  ["getComputedStyle", "the rendered document"],
  ["queueMicrotask", "the scheduler"],
  ["requestAnimationFrame", "the scheduler"],
  ["cancelAnimationFrame", "the scheduler"],
  ["setInterval", "the clock and scheduler"],
  ["clearInterval", "the scheduler"],
  ["setTimeout", "the clock and scheduler"],
  ["clearTimeout", "the scheduler"],
  ["$effect", "the Svelte effect scheduler"]
]);

const exported = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

const functionValue = (node) =>
  node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) ? node : undefined;

/** Top-level exported functions, including const arrow/function expressions. */
export const exportedFunctionNodes = (source) => {
  const found = [];
  for (const statement of source.statements) {
    if (!exported(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      found.push({ name: statement.name?.text ?? "anonymous", node: statement });
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const node = functionValue(declaration.initializer);
      if (node) found.push({ name: declaration.name.text, node });
    }
  }
  return found;
};

/** A capability entry's first value is the authenticated, server-composed context. */
export const hasCapabilityContext = (node) => {
  const [first] = node.parameters ?? [];
  if (!first?.type) return false;
  return /(?:^|\.)CapabilityContext(?:<|$)/.test(first.type.getText().trim());
};

const valueImports = (source) => {
  const found = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    const specifier = statement.moduleSpecifier.text;
    if (clause.name) found.set(clause.name.text, { imported: "default", specifier });
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      found.set(bindings.name.text, { imported: "*", specifier });
    }
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      found.set(element.name.text, {
        imported: (element.propertyName ?? element.name).text,
        specifier
      });
    }
  }
  return found;
};

const declarationName = (node) => {
  const parent = node.parent;
  if (!parent) return false;
  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isClassExpression(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isTypeParameterDeclaration(parent)) &&
    parent.name === node
  ) return true;
  if (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node)) return true;
  if (
    (ts.isPropertyAccessExpression(parent) || ts.isQualifiedName(parent)) &&
    parent.name === node
  ) return true;
  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent)) &&
    parent.name === node
  ) return true;
  if (ts.isLabeledStatement(parent) || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) {
    return parent.label === node;
  }
  return false;
};

const inType = (node) => {
  let at = node.parent;
  while (at && !ts.isSourceFile(at)) {
    if (ts.isTypeNode(at)) return true;
    if (ts.isExpression(at) || ts.isStatement(at)) return false;
    at = at.parent;
  }
  return false;
};

const locallyDeclared = (source) => {
  const found = new Set();
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) {
      for (const name of bindingNames(node.name)) found.add(name);
    }
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node)) &&
      node.name
    ) found.add(node.name.text);
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
};

/**
 * Finds authority a source acquires rather than receives.
 *
 * Calls and mutations through parameters are deliberately absent from this
 * analysis: an explicit port may be observational or mutating. Local callbacks
 * may also close over those received values. The forbidden-import policy names
 * only architectural effect boundaries; ordinary pure helper imports remain
 * available.
 */
export const implicitDependencies = (
  tree,
  path,
  { allowAmbient = new Set(), forbiddenImport = () => undefined } = {}
) => {
  const source = tree.source(path);
  const imports = valueImports(source);
  const declared = locallyDeclared(source);
  const found = new Map();
  const remember = (subject, name, detail, node) => {
    const key = `${subject}:${name}`;
    if (!found.has(key)) found.set(key, { subject, name, detail, node });
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (node.kind === ts.SyntaxKind.ThisKeyword) {
      remember("attached-behavior", "this", "reads state through this instead of an explicit input", node);
    }
    if (ts.isIdentifier(node) && !declarationName(node) && !inType(node)) {
      const imported = imports.get(node.text);
      if (imported) {
        const detail = forbiddenImport({ ...imported, local: node.text, path });
        if (detail) remember("imported-authority", node.text, detail, node);
      }
      const ambient = AMBIENT.get(node.text);
      if (ambient && !allowAmbient.has(node.text) && !declared.has(node.text)) {
        remember("ambient-authority", node.text, `reads ${ambient} through ${node.text}`, node);
      }
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ((node.expression.text === "Date" && node.name.text === "now") ||
        (node.expression.text === "Math" && node.name.text === "random")) &&
      !declared.has(node.expression.text)
    ) {
      const name = `${node.expression.text}.${node.name.text}`;
      remember(
        "ambient-authority",
        name,
        `reads ${node.expression.text === "Date" ? "the clock" : "randomness"} through ${name}`,
        node
      );
    }
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Date" &&
      (node.arguments?.length ?? 0) === 0 &&
      !declared.has("Date")
    ) remember("ambient-authority", "Date", "reads the clock by constructing Date without an input", node);
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return [...found.values()].map((issue) => ({
    ...issue,
    line: tree.lineOf(path, issue.node),
    fingerprint: `${issue.subject}:${issue.name}`
  }));
};

export const functionType = (node) => {
  if (!node) return false;
  if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) return true;
  if (ts.isParenthesizedTypeNode(node)) return functionType(node.type);
  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    return node.types.some(functionType);
  }
  return false;
};
