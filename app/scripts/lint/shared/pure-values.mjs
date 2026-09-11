import ts from "typescript";

export const unwrapExpression = (node) => {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) current = current.expression;
  return current;
};

export const isPrimitiveLiteral = (node) => {
  const value = unwrapExpression(node);
  return (
    ts.isStringLiteral(value) ||
    ts.isNumericLiteral(value) ||
    ts.isBigIntLiteral(value) ||
    ts.isNoSubstitutionTemplateLiteral(value) ||
    value.kind === ts.SyntaxKind.TrueKeyword ||
    value.kind === ts.SyntaxKind.FalseKeyword ||
    value.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isPrefixUnaryExpression(value) && isPrimitiveLiteral(value.operand))
  );
};

/**
 * Runtime-deep immutable literal grammar. `as const` changes only a TypeScript
 * view, so every aggregate level must visibly pass through Object.freeze.
 */
export const isDeeplyFrozenLiteral = (node) => {
  const value = unwrapExpression(node);
  if (isPrimitiveLiteral(value)) return true;
  if (!ts.isCallExpression(value) || value.arguments.length !== 1) return false;
  if (
    !ts.isPropertyAccessExpression(value.expression) ||
    !ts.isIdentifier(value.expression.expression) ||
    value.expression.expression.text !== "Object" ||
    value.expression.name.text !== "freeze"
  ) return false;

  const [literal] = value.arguments;
  if (ts.isArrayLiteralExpression(literal)) {
    return literal.elements.every(
      (element) => !ts.isSpreadElement(element) && isDeeplyFrozenLiteral(element)
    );
  }
  if (!ts.isObjectLiteralExpression(literal)) return false;
  return literal.properties.every(
    (property) =>
      ts.isPropertyAssignment(property) &&
      !ts.isComputedPropertyName(property.name) &&
      isDeeplyFrozenLiteral(property.initializer)
  );
};
