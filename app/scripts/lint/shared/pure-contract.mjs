import ts from "typescript";

export const lineOf = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

export const isExported = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );

export const isFunction = (node) =>
  Boolean(node) &&
  (ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node));

export const unwrap = (node) => {
  let value = node;
  while (
    value &&
    (ts.isParenthesizedExpression(value) ||
      ts.isAsExpression(value) ||
      ts.isTypeAssertionExpression(value) ||
      ts.isSatisfiesExpression(value) ||
      ts.isNonNullExpression(value))
  ) {
    value = value.expression;
  }
  return value;
};

export const staticName = (name) => {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (
    ts.isComputedPropertyName(name) &&
    (ts.isStringLiteral(name.expression) ||
      ts.isNoSubstitutionTemplateLiteral(name.expression) ||
      ts.isNumericLiteral(name.expression))
  ) return name.expression.text;
  return null;
};

export const propertyNamed = (literal, name) =>
  literal?.properties?.find((property) => staticName(property.name) === name) ?? null;

export const propertyValue = (property) => {
  if (!property) return null;
  if (
    ts.isPropertyAssignment(property) ||
    ts.isShorthandPropertyAssignment(property)
  ) return ts.isShorthandPropertyAssignment(property) ? property.name : unwrap(property.initializer);
  if (ts.isMethodDeclaration(property)) return property;
  return null;
};

export const topLevelFunctions = (source, { exportsOnly = false } = {}) => {
  const found = [];
  for (const statement of source.statements) {
    if (exportsOnly && !isExported(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      found.push({ name: statement.name?.text ?? "default", node: statement, declaration: statement });
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const node = unwrap(declaration.initializer);
      if (!isFunction(node)) continue;
      found.push({ name: declaration.name.text, node, declaration });
    }
  }
  return found;
};

export const returnExpressions = (fn) => {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [unwrap(fn.body)];
  if (!fn.body || !ts.isBlock(fn.body)) return [];
  const found = [];
  const visit = (node) => {
    if (node !== fn && isFunction(node)) return;
    if (ts.isReturnStatement(node) && node.expression) found.push(unwrap(node.expression));
    node.forEachChild(visit);
  };
  fn.body.forEachChild(visit);
  return found;
};

export const visit = (node, callback) => {
  const step = (child) => {
    callback(child);
    child.forEachChild(step);
  };
  step(node);
};

export const callPath = (expression) => {
  const value = unwrap(expression);
  if (ts.isIdentifier(value)) return [value.text];
  if (ts.isPropertyAccessExpression(value)) {
    const parent = callPath(value.expression);
    return parent ? [...parent, value.name.text] : null;
  }
  if (
    ts.isElementAccessExpression(value) &&
    value.argumentExpression &&
    (ts.isStringLiteral(value.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(value.argumentExpression))
  ) {
    const parent = callPath(value.expression);
    return parent ? [...parent, value.argumentExpression.text] : null;
  }
  return null;
};

export const literalStrings = (node) => {
  const value = unwrap(node);
  if (!value || !ts.isArrayLiteralExpression(value)) return null;
  const found = [];
  for (const element of value.elements) {
    const item = unwrap(element);
    if (!ts.isStringLiteral(item) && !ts.isNoSubstitutionTemplateLiteral(item)) return null;
    found.push(item.text);
  }
  return found;
};

export const pascal = (value) =>
  value.replace(/(^|-)([a-z0-9])/g, (_, __, character) => character.toUpperCase());

export const broadTypeNode = (node, { functions = true, unknown = true } = {}) => {
  if (!node) return null;
  let found = null;
  visit(node, (child) => {
    if (found) return;
    if (
      child.kind === ts.SyntaxKind.AnyKeyword ||
      child.kind === ts.SyntaxKind.ObjectKeyword ||
      (unknown && child.kind === ts.SyntaxKind.UnknownKeyword) ||
      (functions &&
        (ts.isFunctionTypeNode(child) ||
          ts.isConstructorTypeNode(child) ||
          ts.isCallSignatureDeclaration(child) ||
          ts.isConstructSignatureDeclaration(child))) ||
      ts.isIndexSignatureDeclaration(child) ||
      (ts.isTypeReferenceNode(child) && ["Function", "Record"].includes(child.typeName.getText()))
    ) found = child;
  });
  return found;
};

export const productionTypeScript = (tree, root) =>
  tree.under(root).filter(
    (path) =>
      path.endsWith(".ts") &&
      !path.endsWith(".d.ts") &&
      !/(?:^|\/)(?:test|tests|__tests__|fixture|fixtures)(?:\/|$)/.test(path) &&
      !/(?:^|\.)(?:test|spec|fixture|stories)\.ts$/.test(path)
  );
