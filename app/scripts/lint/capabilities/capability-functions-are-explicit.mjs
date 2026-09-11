import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  exportedFunctionNodes,
  hasCapabilityContext,
  implicitDependencies
} from "../shared/explicit-dependencies.mjs";
import { capabilities, procedureEntries } from "../shared/trees.mjs";

const REMOTE_FACTORIES = new Set(["command", "form", "prerender", "query"]);

const sameCapability = (tree, path, specifier) => {
  const target = tree.aliasTarget(specifier);
  if (target?.tree !== "capabilities") return false;
  const own = tree.rel(path).split("/")[3];
  return target.segments[0] === own;
};

const forbiddenImport = (tree, path) => ({ specifier, imported }) => {
  if (specifier.startsWith("node:")) return `imports ${imported} from ${specifier} instead of receiving an interface`;
  if (specifier.startsWith("$runtime/")) return `acquires ${imported} from ${specifier} instead of CapabilityContext`;
  if (specifier.startsWith("$capabilities/") && !sameCapability(tree, path, specifier)) {
    return `acquires another capability through ${specifier} instead of a supplied port`;
  }
  return undefined;
};

const remoteBindings = (tree, index) => {
  const found = [];
  const source = tree.source(index);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue;
      const outer = declaration.initializer;
      const callee = outer.expression;
      if (!ts.isIdentifier(callee) || !REMOTE_FACTORIES.has(callee.text)) continue;
      const handler = outer.arguments.at(-1);
      const bound =
        handler &&
        ts.isCallExpression(handler) &&
        ts.isIdentifier(handler.expression) &&
        handler.expression.text === "bindCapability";
      if (bound) continue;
      found.push({
        name: declaration.name.getText(source),
        node: handler ?? outer
      });
    }
  }
  return found;
};

export default check({
  name: "capability-functions-are-explicit",
  says: "Capability entries receive authenticated context, and capability functions acquire no hidden authority.",
  subjects: {
    "entry-context": "every capability entry receives CapabilityContext first",
    "remote-adapter": "every remote declaration binds its entry through bindCapability",
    "implicit-dependency": "capability functions receive clocks, models and other effect boundaries"
  },
  run(tree) {
    const found = [];
    for (const path of procedureEntries(tree)) {
      for (const { name, node } of exportedFunctionNodes(tree.source(path))) {
        if (hasCapabilityContext(node)) continue;
        found.push({
          subject: "entry-context",
          path,
          line: tree.lineOf(path, node),
          fingerprint: name,
          message: `${name} does not receive CapabilityContext as its first input`
        });
      }
    }

    for (const { path } of capabilities(tree)) {
      const index = `${path}/index.remote.ts`;
      if (!tree.isFile(index)) continue;
      for (const { name, node } of remoteBindings(tree, index)) {
        found.push({
          subject: "remote-adapter",
          path: index,
          line: tree.lineOf(index, node),
          fingerprint: name,
          message: `${name} exposes a procedure without bindCapability(...) supplying authenticated context`
        });
      }
    }

    for (const path of tree.under(tree.path("capabilities"))) {
      if (!path.endsWith(".ts") || !tree.rel(path).includes("/api/") || path.includes("/test/")) continue;
      for (const issue of implicitDependencies(tree, path, { forbiddenImport: forbiddenImport(tree, path) })) {
        found.push({
          subject: "implicit-dependency",
          path,
          line: issue.line,
          fingerprint: issue.fingerprint,
          message: issue.detail
        });
      }
    }
    return found;
  }
});
