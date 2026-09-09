import ts from "typescript";

import { check } from "../shared/check.mjs";

const STATEFUL_FACTORY = /create(?:[A-Z]\w*)?(?:Runtimes|Storage|WorkspaceState|Queries|Preferences)\b/;

const factoryName = (initializer) => {
  let node = initializer;
  while (
    ts.isAwaitExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node)
  ) node = node.expression;
  if (!ts.isCallExpression(node)) return undefined;
  const callee = node.expression;
  return ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : undefined;
};

export default check({
  id: "LIFE-05",
  pillar: "owned-lifecycle",
  finding: "ARCH-11",
  name: "stateful-client-object-has-release",
  says: "Every stateful object built by the client composition root is reached by client shutdown cleanup.",
  run(tree) {
    const path = tree.path("runtime", "client", "start.ts");
    const built = [];
    tree.eachNode(path, (node) => {
      if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
      const factory = factoryName(node.initializer);
      if (!factory || !STATEFUL_FACTORY.test(factory)) return;
      built.push({ name: node.name.text, node });
    });
    const closeAt = tree.read(path).indexOf("close:");
    const cleanup = closeAt < 0 ? "" : tree.read(path).slice(closeAt);
    return built
      .filter(({ name }) => !new RegExp(`\\b${name}\\.(?:release|releaseAll|close|dispose)\\s*\\(`).test(cleanup))
      .map(({ name, node }) => ({
        path,
        line: tree.lineOf(path, node),
        fingerprint: name,
        message: `${name} is stateful but ClientModel.close() does not release it`
      }));
  }
});
