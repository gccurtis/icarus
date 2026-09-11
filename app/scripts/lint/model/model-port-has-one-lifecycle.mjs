import { join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  callPath,
  isFunction,
  lineOf,
  literalStrings,
  pascal,
  propertyNamed,
  propertyValue,
  returnExpressions,
  staticName,
  topLevelFunctions,
  unwrap,
  visit
} from "../shared/pure-contract.mjs";
import { isProductionPath } from "../shared/pure-islands.mjs";
import { objects } from "../shared/trees.mjs";

const frozenObject = (expression) => {
  const value = unwrap(expression);
  if (ts.isObjectLiteralExpression(value)) return { literal: value, frozen: false };
  if (
    ts.isCallExpression(value) &&
    callPath(value.expression)?.join(".") === "Object.freeze" &&
    ts.isObjectLiteralExpression(unwrap(value.arguments[0]))
  ) return { literal: unwrap(value.arguments[0]), frozen: true };
  return null;
};

const memberCalls = (node) => {
  const calls = [];
  visit(node, (child) => {
    if (child !== node && isFunction(child)) return;
    if (ts.isCallExpression(child)) calls.push(child);
  });
  return calls;
};

const importedMethodNames = (tree, root, path) => {
  const found = new Set();
  for (const edge of tree.imports(path)) {
    const target = tree.resolve(edge.specifier, path);
    if (!target || !tree.within(join(root, "methods"), target)) continue;
    for (const name of edge.names) found.add(name);
  }
  return found;
};

export default check({
  name: "model-port-has-one-lifecycle",
  baseline: false,
  says: "Each model exposes one exact runtime-only adapter and fresh acquired ports with commit but no lifecycle escape.",
  subjects: {
    layout: "one port.ts owns the model binding and lifecycle",
    "outer-adapter": "the outer adapter exposes only literal metadata and acquire/release/optional close",
    "acquired-port": "each acquisition returns a fresh frozen exact facade with commit and no outer lifecycle",
    provenance: "port binding imports only its own model and receives infrastructure explicitly",
    delegation: "ordinary port operations are one-call wrappers around named free model methods",
    reflection: "ports contain no accessors, hidden properties, reflective dispatch, or broad escape types"
  },
  run(tree) {
    const found = [];
    for (const { id, name, path: root } of objects(tree)) {
      const path = join(root, "port.ts");
      if (!tree.isFile(path)) {
        found.push({
          subject: "layout",
          path: root,
          fingerprint: `${id}:missing-port`,
          message: `${id} has no port.ts defining its acquired port and outer adapter`
        });
        continue;
      }

      const source = tree.source(path);
      const expected = `bind${pascal(name)}`;
      const bindings = topLevelFunctions(source, { exportsOnly: true }).filter(({ name: binding }) => binding.startsWith("bind"));
      if (bindings.length !== 1 || bindings[0]?.name !== expected) {
        found.push({
          subject: "layout",
          path,
          line: 1,
          fingerprint: `${id}:bindings:${bindings.map(({ name: binding }) => binding).join(",")}`,
          message: `port.ts must export exactly ${expected}; found ${bindings.map(({ name: binding }) => binding).join(", ") || "none"}`
        });
      }

      for (const edge of tree.imports(path)) {
        const target = tree.resolve(edge.specifier, path);
        if (target && tree.within(root, target) && isProductionPath(root, target)) continue;
        found.push({
          subject: "provenance",
          path,
          line: edge.line,
          fingerprint: `import:${edge.specifier}`,
          message: `port.ts imports ${edge.specifier}; infrastructure implementations must be explicit binding parameters`
        });
      }

      const binding = bindings.find(({ name: bindingName }) => bindingName === expected) ?? bindings[0];
      const outerReturns = binding ? returnExpressions(binding.node) : [];
      const outer = outerReturns.length === 1 ? frozenObject(outerReturns[0]) : null;
      if (!outer) {
        found.push({
          subject: "outer-adapter",
          path,
          line: binding ? lineOf(source, binding.node) : 1,
          fingerprint: `${id}:outer-literal`,
          message: `${expected} must visibly return one exact object-literal adapter`
        });
      } else {
        const names = outer.literal.properties.map((property) => staticName(property.name));
        const allowed = new Set(["lifetime", "commitMode", "acquire", "release", "close"]);
        const extra = names.filter((property) => !allowed.has(property));
        const required = ["lifetime", "commitMode", "acquire", "release"].filter((property) => !names.includes(property));
        if (extra.length > 0 || required.length > 0 || names.some((property) => property === null)) {
          found.push({
            subject: "outer-adapter",
            path,
            line: lineOf(source, outer.literal),
            fingerprint: `${id}:outer:${names.join(",")}`,
            message: `outer adapter has ${extra.length ? `undeclared ${extra.join(", ")}` : "no extra members"} and is missing ${required.join(", ") || "nothing"}`
          });
        }
        const lifetime = propertyValue(propertyNamed(outer.literal, "lifetime"));
        const mode = propertyValue(propertyNamed(outer.literal, "commitMode"));
        if (!lifetime || !ts.isStringLiteral(lifetime)) {
          found.push({
            subject: "outer-adapter",
            path,
            line: lineOf(source, propertyNamed(outer.literal, "lifetime") ?? outer.literal),
            fingerprint: `${id}:lifetime`,
            message: "outer adapter lifetime must be a string literal"
          });
        }
        if (!mode || !ts.isStringLiteral(mode) || !["staged", "immediate", "read-only"].includes(mode.text)) {
          found.push({
            subject: "outer-adapter",
            path,
            line: lineOf(source, propertyNamed(outer.literal, "commitMode") ?? outer.literal),
            fingerprint: `${id}:commit-mode`,
            message: "outer adapter commitMode must be the literal staged, immediate, or read-only"
          });
        }

        const acquire = propertyValue(propertyNamed(outer.literal, "acquire"));
        const acquiredReturns = isFunction(acquire) ? returnExpressions(acquire) : [];
        const acquired = acquiredReturns.length === 1 ? frozenObject(acquiredReturns[0]) : null;
        if (!acquired || !acquired.frozen) {
          found.push({
            subject: "acquired-port",
            path,
            line: lineOf(source, acquire ?? outer.literal),
            fingerprint: `${id}:fresh-frozen`,
            message: "acquire must allocate and Object.freeze one visible lease facade"
          });
        } else {
          const members = acquired.literal.properties.map((property) => staticName(property.name));
          const escaped = members.filter((member) => ["acquire", "release", "close", "state", "model", "adapter"].includes(member));
          if (!members.includes("commit") || escaped.length > 0 || members.some((member) => member === null)) {
            found.push({
              subject: "acquired-port",
              path,
              line: lineOf(source, acquired.literal),
              fingerprint: `${id}:acquired:${members.join(",")}`,
              message: `acquired facade must contain commit and no outer lifecycle/raw state; escaped ${escaped.join(", ") || "none"}`
            });
          }

          const methods = importedMethodNames(tree, root, path);
          for (const property of acquired.literal.properties) {
            const member = staticName(property.name);
            if (!member || member === "commit") continue;
            const body = propertyValue(property);
            if (!isFunction(body)) continue;
            const calls = memberCalls(body);
            const delegated = calls.filter((call) => {
              const [head] = callPath(call.expression) ?? [];
              return methods.has(head);
            });
            if (delegated.length === 1 && calls.length === 1) continue;
            found.push({
              subject: "delegation",
              path,
              line: lineOf(source, property),
              fingerprint: `${id}:delegate:${member}`,
              message: `${member} must make exactly one statically named call to an imported free model method`
            });
          }
        }
      }

      visit(source, (node) => {
        const reflectiveCall =
          ts.isCallExpression(node) &&
          ["Proxy", "Reflect", "Symbol", "Object.defineProperty", "Object.defineProperties", "Object.setPrototypeOf"]
            .some((name) => callPath(node.expression)?.join(".") === name);
        if (
          ts.isClassDeclaration(node) ||
          ts.isClassExpression(node) ||
          ts.isGetAccessorDeclaration(node) ||
          ts.isSetAccessorDeclaration(node) ||
          ts.isSpreadAssignment(node) ||
          ts.isIndexSignatureDeclaration(node) ||
          node.kind === ts.SyntaxKind.AnyKeyword ||
          node.kind === ts.SyntaxKind.UnknownKeyword ||
          reflectiveCall
        ) {
          found.push({
            subject: "reflection",
            path,
            line: lineOf(source, node),
            fingerprint: `${id}:${node.pos}:${ts.SyntaxKind[node.kind]}`,
            message: `port.ts contains ${ts.SyntaxKind[node.kind]} instead of an exact own-property lifecycle surface`
          });
        }
      });
    }
    return found;
  }
});
