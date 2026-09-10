import ts from "typescript";

import {
  DEFAULT_HELPER,
  READ_PRESERVING_HELPER,
  REQUIRED_DISCRIMINATOR_READS,
  readsFor
} from "./current-read-registry.mjs";

const accessedMemberName = (node) => {
  let held = node;
  while (ts.isParenthesizedExpression(held)) held = held.expression;
  if (ts.isPropertyAccessExpression(held)) return held.name.text;
  if (
    ts.isElementAccessExpression(held) &&
    held.argumentExpression !== undefined &&
    (ts.isStringLiteral(held.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(held.argumentExpression))
  ) return held.argumentExpression.text;
  return undefined;
};

const unwrapped = (node) => {
  let held = node;
  while (
    ts.isParenthesizedExpression(held) ||
    ts.isAsExpression(held) ||
    ts.isTypeAssertionExpression(held) ||
    ts.isNonNullExpression(held) ||
    ts.isSatisfiesExpression(held)
  ) held = held.expression;
  return held;
};

const accessPath = (node) => {
  const held = unwrapped(node);
  if (ts.isIdentifier(held)) return held.text;
  if (ts.isPropertyAccessExpression(held)) {
    const owner = accessPath(held.expression);
    return owner === undefined ? undefined : `${owner}.${held.name.text}`;
  }
  if (
    ts.isElementAccessExpression(held) &&
    held.argumentExpression !== undefined &&
    (ts.isStringLiteral(held.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(held.argumentExpression))
  ) {
    const owner = accessPath(held.expression);
    return owner === undefined ? undefined : `${owner}.${held.argumentExpression.text}`;
  }
  return undefined;
};

const matchingRead = (key, reads) => {
  if (key === undefined) return undefined;
  for (const read of reads) {
    if (read.startsWith("*.") ? key.endsWith(read.slice(1)) : key === read) return read;
  }
  return undefined;
};

const referenceIdentifier = (node) => {
  const parent = node.parent;
  if (parent === undefined) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
  if (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node)) {
    return false;
  }
  return true;
};

const currentReadsIn = (node, reads, aliases) => {
  const found = new Set();
  const visit = (held) => {
    if (ts.isPropertyAccessExpression(held) || ts.isElementAccessExpression(held)) {
      const matched = matchingRead(accessPath(held), reads);
      if (matched !== undefined) found.add(matched);
    } else if (ts.isIdentifier(held) && referenceIdentifier(held)) {
      for (const matched of aliases.get(held.text) ?? []) found.add(matched);
    }
    held.forEachChild(visit);
  };
  visit(node);
  return found;
};

const carriedReadsIn = (node, reads, aliases) => {
  const held = unwrapped(node);
  if (ts.isPropertyAccessExpression(held) || ts.isElementAccessExpression(held)) {
    const matched = matchingRead(accessPath(held), reads);
    return new Set(matched === undefined ? [] : [matched]);
  }
  if (ts.isIdentifier(held)) return new Set(aliases.get(held.text) ?? []);
  if (ts.isCallExpression(held)) {
    const callee = unwrapped(held.expression);
    const helper = accessedMemberName(held.expression) ??
      (ts.isIdentifier(callee) ? callee.text : undefined);
    if (helper !== undefined && READ_PRESERVING_HELPER.test(helper)) {
      const found = new Set();
      for (const argument of held.arguments) {
        for (const matched of currentReadsIn(argument, reads, aliases)) found.add(matched);
      }
      return found;
    }
  }
  return new Set();
};

const aliasesIn = (source, reads) => {
  const aliases = new Map();
  const declarations = new Map();
  const count = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      declarations.set(node.name.text, (declarations.get(node.name.text) ?? 0) + 1);
    }
    node.forEachChild(count);
  };
  count(source);
  // Repeating follows small chains such as `const held = row.body; const body = held`.
  for (let pass = 0; pass < 3; pass += 1) {
    const visit = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer !== undefined &&
        !ts.isArrowFunction(node.initializer) &&
        !ts.isFunctionExpression(node.initializer) &&
        declarations.get(node.name.text) === 1
      ) {
        const held = carriedReadsIn(node.initializer, reads, aliases);
        if (held.size > 0) aliases.set(node.name.text, held);
      }
      node.forEachChild(visit);
    };
    visit(source);
  }
  return aliases;
};

const withinRejectingGuard = (node) => {
  let held = node;
  while (held.parent !== undefined) {
    if (ts.isIfStatement(held.parent)) return held.parent.expression === held;
    if (ts.isStatement(held.parent) || ts.isFunctionLike(held.parent)) return false;
    held = held.parent;
  }
  return false;
};

const absenceTestReadsIn = (node, reads, aliases) => {
  const found = new Set();
  const record = (held) => {
    for (const key of currentReadsIn(held, reads, aliases)) found.add(key);
  };
  const visit = (held) => {
    if (ts.isBinaryExpression(held)) {
      const kind = held.operatorToken.kind;
      if (kind === ts.SyntaxKind.InKeyword) {
        const field = ts.isStringLiteral(held.left) || ts.isNoSubstitutionTemplateLiteral(held.left)
          ? held.left.text
          : undefined;
        const owner = accessPath(held.right);
        const matched = matchingRead(
          field === undefined || owner === undefined ? undefined : `${owner}.${field}`,
          reads
        );
        if (matched !== undefined) found.add(matched);
      }
      if (
        kind === ts.SyntaxKind.EqualsEqualsToken ||
        kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        kind === ts.SyntaxKind.ExclamationEqualsToken ||
        kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
      ) {
        const absent = (candidate) =>
          candidate.kind === ts.SyntaxKind.NullKeyword ||
          (ts.isIdentifier(candidate) && candidate.text === "undefined") ||
          ts.isTypeOfExpression(candidate) ||
          ts.isStringLiteral(candidate);
        if (absent(unwrapped(held.right))) record(held.left);
        if (absent(unwrapped(held.left))) record(held.right);
      }
    }
    if (ts.isCallExpression(held)) {
      const callee = unwrapped(held.expression);
      const helper = accessedMemberName(held.expression) ??
        (ts.isIdentifier(callee) ? callee.text : undefined);
      if (/^(?:hasOwn|hasOwnProperty|isDefined|isPresent)$/i.test(helper ?? "")) record(held);
    }
    held.forEachChild(visit);
  };
  visit(node);
  return found;
};

const defaultedCurrentReadsIn = (node, reads, aliases, found) => {
  const record = (keys, syntax) => {
    for (const key of keys) found.add(`${key}:${syntax}`);
  };
  if (ts.isBinaryExpression(node)) {
    const kind = node.operatorToken.kind;
    if (
      kind === ts.SyntaxKind.QuestionQuestionToken ||
      kind === ts.SyntaxKind.QuestionQuestionEqualsToken ||
      kind === ts.SyntaxKind.BarBarEqualsToken ||
      (kind === ts.SyntaxKind.BarBarToken && !withinRejectingGuard(node))
    ) record(currentReadsIn(node.left, reads, aliases), node.operatorToken.getText());
  }
  if (ts.isConditionalExpression(node)) {
    const condition = absenceTestReadsIn(node.condition, reads, aliases);
    const yes = currentReadsIn(node.whenTrue, reads, aliases);
    const no = currentReadsIn(node.whenFalse, reads, aliases);
    record(new Set([...condition].filter((key) => yes.has(key) !== no.has(key))), "?:");
  }
  if (
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
    (node.questionDotToken !== undefined || (node.flags & ts.NodeFlags.OptionalChain) !== 0) &&
    !withinRejectingGuard(node)
  ) {
    const matched = matchingRead(accessPath(node), reads);
    if (matched !== undefined) record([matched], "?.");
  }
  if (ts.isCallExpression(node)) {
    const callee = unwrapped(node.expression);
    const helper = accessedMemberName(node.expression) ??
      (ts.isIdentifier(callee) ? callee.text : undefined);
    if (helper !== undefined && DEFAULT_HELPER.test(helper)) {
      for (const argument of node.arguments) {
        record(currentReadsIn(argument, reads, aliases), `${helper}(…)`);
      }
    }
  }
  if (
    ts.isBindingElement(node) &&
    node.initializer !== undefined &&
    (ts.isIdentifier(node.propertyName) || ts.isStringLiteral(node.propertyName) ||
      (node.propertyName === undefined && ts.isIdentifier(node.name)))
  ) {
    const declaration = node.parent.parent;
    const owner = ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined
      ? accessPath(declaration.initializer)
      : undefined;
    const field = node.propertyName?.text ?? node.name.text;
    const matched = matchingRead(owner === undefined ? undefined : `${owner}.${field}`, reads);
    if (matched !== undefined) record([matched], "binding=");
  }
};

const absenceDefaultedDiscriminatorIn = (node, found) => {
  if (
    !ts.isBinaryExpression(node) ||
    (node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken &&
      node.operatorToken.kind !== ts.SyntaxKind.BarBarToken)
  ) return;
  const field = accessedMemberName(node.left);
  if (field !== undefined && REQUIRED_DISCRIMINATOR_READS.has(field)) {
    found.add(`${field}${node.operatorToken.getText()}`);
  }
};

export const currentReadStateFor = (source, path) => {
  const reads = readsFor(path);
  return {
    reads,
    aliases: reads === undefined ? new Map() : aliasesIn(source, reads)
  };
};

export const currentReadMarkersIn = (node, state, found) => {
  absenceDefaultedDiscriminatorIn(node, found);
  if (state.reads !== undefined) {
    defaultedCurrentReadsIn(node, state.reads, state.aliases, found);
  }
};
