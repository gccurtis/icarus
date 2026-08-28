import ts from "typescript";

import { check } from "../shared/check.mjs";
import { bodyOfDeclaration, declarationNamed, returnedObject, roots } from "../shared/runtime.mjs";

const CONSTRUCTOR = /^create[A-Z]/;

/**
 * Every object the builder stands up, in the order it stands them up.
 *
 * A construction is either bound to a name — `const workbench = createWorkbench(…)`
 * — or assigned straight into the returned graph, which is the same moment read
 * a line later. Both are collected, because an object built in the literal can
 * still be handed something built after it.
 */
const constructions = (tree, path, body) => {
  const found = [];
  const record = (name, call) => {
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return;
    if (!CONSTRUCTOR.test(call.expression.text)) return;
    const takes = [];
    for (const argument of call.arguments) {
      const step = (node) => {
        if (ts.isIdentifier(node)) takes.push(node.text);
        node.forEachChild(step);
      };
      step(argument);
    }
    found.push({ name, callee: call.expression.text, takes, line: tree.lineOf(path, call) });
  };

  const unwrap = (node) => (node && ts.isAwaitExpression(node) ? node.expression : node);

  if (ts.isBlock(body)) {
    for (const statement of body.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        record(declaration.name.text, unwrap(declaration.initializer));
      }
    }
  }

  const literal = returnedObject(body);
  for (const property of literal?.properties ?? []) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (!property.name || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) continue;
    record(property.name.text, unwrap(property.initializer));
  }
  return found;
};

const cycleFrom = (edges, start) => {
  const walk = (at, chain) => {
    for (const next of edges.get(at) ?? []) {
      if (chain.includes(next)) return [...chain.slice(chain.indexOf(next)), next];
      const found = walk(next, [...chain, next]);
      if (found) return found;
    }
    return null;
  };
  return walk(start, [start]);
};

export default check({
  name: "objects-are-built-in-order",
  says: "The graph is assembled in dependency order, every object constructed once.",
  subjects: {
    "after-dependencies": "an object is constructed after everything it is passed",
    "constructed-once": "each object door is called exactly once",
    "no-cycle": "the dependency graph is acyclic"
  },
  run(tree) {
    const found = [];
    for (const { builder, startPath } of roots(tree)) {
      if (!tree.isFile(startPath)) continue;
      const body = bodyOfDeclaration(declarationNamed(tree, startPath, builder));
      if (!body) continue;

      const built = constructions(tree, startPath, body);
      const order = new Map(built.map(({ name }, index) => [name, index]));
      const edges = new Map(built.map(({ name, takes }) => [name, takes.filter((n) => order.has(n))]));

      built.forEach(({ name, takes, line }, index) => {
        for (const taken of takes) {
          const at = order.get(taken);
          if (at === undefined || at < index) continue;
          found.push({
            subject: "after-dependencies",
            path: startPath,
            line,
            message: `${name} is handed ${taken}, which is constructed after it`
          });
        }
      });

      const calls = new Map();
      for (const { callee } of built) calls.set(callee, (calls.get(callee) ?? 0) + 1);
      for (const [callee, count] of calls) {
        if (count === 1) continue;
        found.push({
          subject: "constructed-once",
          path: startPath,
          message: `${callee}() is called ${count} times, which is ${count} instances of one object`
        });
      }

      const reported = new Set();
      for (const { name } of built) {
        const cycle = cycleFrom(edges, name);
        if (!cycle) continue;
        const key = [...cycle].sort().join(",");
        if (reported.has(key)) continue;
        reported.add(key);
        found.push({ subject: "no-cycle", path: startPath, message: `cycle: ${cycle.join(" → ")}` });
      }
    }
    return found;
  }
});
