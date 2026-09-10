/**
 * What a module does simply by being imported.
 *
 * Three trees care, for the same reason with three different consequences: a
 * capability holds nothing between calls, a model object is constructed by the
 * runtime rather than by an import, and a surface's shared state dies with the
 * mount. A module-scope binding or a module-scope construction defeats all
 * three, and a request, an instance, or a mount is not where it would show up.
 */
import ts from "typescript";

/** `let` and `var` at module scope. A `const` is a binding nothing can reassign. */
export const mutableBindings = (tree, path) => {
  if (!/\.(ts|js)$/.test(path)) return [];
  const found = [];
  for (const statement of tree.source(path).statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const flags = statement.declarationList.flags;
    if (flags & ts.NodeFlags.Const) continue;
    for (const declaration of statement.declarationList.declarations) {
      found.push({
        name: declaration.name.getText(tree.source(path)),
        line: tree.lineOf(path, declaration),
        keyword: flags & ts.NodeFlags.Let ? "let" : "var"
      });
    }
  }
  return found;
};

const constructionName = (node) => {
  if (ts.isNewExpression(node)) {
    return `new ${node.expression.getText?.() ?? "?"}`;
  }
  if (!ts.isCallExpression(node)) return null;
  const callee = node.expression;
  const name = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : null;
  return name && /^(create|build|init|make|open|connect|start)[A-Z]/.test(name) ? `${name}()` : null;
};

/**
 * Constructions that run when the module is imported — not the ones inside a
 * function, which are a later moment and the caller's business.
 */
export const constructionsAtLoad = (tree, path) => {
  if (!/\.(ts|js)$/.test(path)) return [];
  const found = [];
  tree.eachImmediate(path, (node) => {
    const name = constructionName(node);
    if (name) found.push({ name, line: tree.lineOf(path, node) });
  });
  return found;
};

const unwrap = (node) => {
  let held = node;
  while (
    held &&
    (ts.isAsExpression(held) ||
      ts.isTypeAssertionExpression(held) ||
      ts.isParenthesizedExpression(held) ||
      ts.isNonNullExpression(held))
  ) held = held.expression;
  return held;
};

const rootIdentifier = (node) => {
  let held = unwrap(node);
  while (held && (ts.isPropertyAccessExpression(held) || ts.isElementAccessExpression(held))) {
    held = unwrap(held.expression);
  }
  return held && ts.isIdentifier(held) ? held.text : undefined;
};

const MUTATING_MEMBERS = new Set(["abort", "add", "clear", "delete", "set"]);

/**
 * Ambient-backed state can be lazy and function-local while still surviving
 * every request. Find aliases of `globalThis`, writes through them, and calls
 * that mutate a collection/controller reached through them.
 */
export const ambientStateMutations = (tree, path) => {
  if (!/\.(ts|js)$/.test(path)) return [];
  const aliases = new Map([["globalThis", 1]]);
  tree.eachNode(path, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    if (rootIdentifier(node.initializer) !== "globalThis") return;
    aliases.set(node.name.text, tree.lineOf(path, node));
  });

  const found = new Map();
  tree.eachNode(path, (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const root = rootIdentifier(node.left);
      if (root !== undefined && aliases.has(root)) {
        const line = tree.lineOf(path, node);
        found.set(`${root}:${line}`, { name: root, line });
      }
      return;
    }
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (!MUTATING_MEMBERS.has(node.expression.name.text)) return;
    const root = rootIdentifier(node.expression.expression);
    if (root === undefined || !aliases.has(root)) return;
    const line = tree.lineOf(path, node);
    found.set(`${root}:${line}`, { name: root, line });
  });
  return [...found.values()];
};
