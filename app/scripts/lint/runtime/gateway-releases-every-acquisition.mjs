import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  callPath,
  isFunction,
  lineOf,
  topLevelFunctions,
  visit
} from "../shared/pure-contract.mjs";

const invokePath = (tree) =>
  tree.path("runtime", "server", "capabilities", "invoke.server.ts");

const callsInside = (node) => {
  const found = [];
  const step = (child) => {
    if (child !== node && isFunction(child)) return;
    if (ts.isCallExpression(child)) {
      found.push({ node: child, path: callPath(child.expression) });
    }
    child.forEachChild(step);
  };
  step(node);
  return found;
};

const namedCall = (calls, pattern) =>
  calls.find(({ path }) => path && pattern.test(path.at(-1)));

export default check({
  name: "gateway-releases-every-acquisition",
  baseline: false,
  says: "The one capability runner commits only successful encoded work and releases every acquisition in reverse from finally.",
  subjects: {
    singular: "one small exported runtime function owns capability invocation lifecycle",
    acquire: "partial and complete acquisitions are tracked inside the guarded lifecycle",
    order: "entry, result encoding, and automatic commit occur in that order",
    release: "finally releases all successful acquisitions in reverse order",
    faults: "cleanup continues and preserves the primary fault without classifying it",
    escape: "the runner returns encoded data and never a live lease or closure"
  },
  run(tree) {
    const path = invokePath(tree);
    if (!tree.isFile(path)) {
      return [{
        subject: "singular",
        path,
        line: 1,
        fingerprint: "missing-invoke-runner",
        message: "runtime/server/capabilities/invoke.server.ts is missing"
      }];
    }

    const source = tree.source(path);
    const found = [];
    const exported = topLevelFunctions(source, { exportsOnly: true });
    const runners = exported.filter(({ name }) => /invoke.*capability|run.*capability/i.test(name));
    if (runners.length !== 1 || exported.length !== 1) {
      found.push({
        subject: "singular",
        path,
        line: 1,
        fingerprint: `runner-count:${runners.length}:${exported.length}`,
        message: `invoke.server.ts must export one lifecycle runner and no alternate function; found ${exported.length}`
      });
    }

    const runner = runners[0] ?? exported[0];
    if (!runner) return found;
    const tries = [];
    const step = (node) => {
      if (node !== runner.node && isFunction(node)) return;
      if (ts.isTryStatement(node)) tries.push(node);
      node.forEachChild(step);
    };
    step(runner.node);
    const guarded = tries.find((statement) => statement.finallyBlock);
    if (!guarded) {
      found.push({
        subject: "release",
        path,
        line: lineOf(source, runner.node),
        fingerprint: "missing-finally",
        message: "capability lifecycle runner has no try/finally cleanup boundary"
      });
      return found;
    }

    const allCalls = callsInside(runner.node);
    const tryCalls = callsInside(guarded.tryBlock);
    const finallyCalls = callsInside(guarded.finallyBlock);
    const acquire = namedCall(allCalls, /^acquire$/i);
    const entry = namedCall(tryCalls, /^(?:entry|invokeEntry|callEntry)$/i) ??
      tryCalls.find(({ path: parts }) => parts?.includes("entry"));
    const encode = namedCall(tryCalls, /^(?:encode|encodeResult|validateResult|admitResult)$/i);
    const commit = namedCall(tryCalls, /^commit$/i);
    const release = namedCall(finallyCalls, /^release$/i);

    if (!acquire || acquire.node.pos > guarded.tryBlock.end) {
      found.push({
        subject: "acquire",
        path,
        line: lineOf(source, guarded),
        fingerprint: "unguarded-acquisition",
        message: "runner must visibly acquire and track model leases within its guarded lifecycle"
      });
    }
    if (!entry || !encode || !commit || !(entry.node.pos < encode.node.pos && encode.node.pos < commit.node.pos)) {
      found.push({
        subject: "order",
        path,
        line: lineOf(source, guarded.tryBlock),
        fingerprint: `success-order:${Boolean(entry)}:${Boolean(encode)}:${Boolean(commit)}`,
        message: "normal path must invoke the entry, encode its data result, then auto-commit"
      });
    }

    const finallyText = guarded.finallyBlock.getText(source);
    if (!release || !/(?:reverse|toReversed|--)/.test(finallyText)) {
      found.push({
        subject: "release",
        path,
        line: lineOf(source, guarded.finallyBlock),
        fingerprint: "reverse-release",
        message: "finally must continue through every tracked acquisition in reverse order"
      });
    }
    if (finallyCalls.some(({ path: parts }) => parts?.at(-1) === "commit")) {
      found.push({
        subject: "release",
        path,
        line: lineOf(source, guarded.finallyBlock),
        fingerprint: "commit-in-finally",
        message: "cleanup cannot commit or publish staged work"
      });
    }

    for (const statement of tries) {
      if (!statement.catchClause?.variableDeclaration || !ts.isIdentifier(statement.catchClause.variableDeclaration.name)) continue;
      const error = statement.catchClause.variableDeclaration.name.text;
      let classified = null;
      visit(statement.catchClause.block, (node) => {
        if (
          ts.isPropertyAccessExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === error
        ) classified ??= node;
      });
      if (!classified) continue;
      found.push({
        subject: "faults",
        path,
        line: lineOf(source, classified),
        fingerprint: `classified-fault:${classified.name.text}`,
        message: `runner inspects caught fault.${classified.name.text}; primary faults must be preserved opaquely`
      });
    }

    const returns = [];
    const returnStep = (node) => {
      if (node !== runner.node && isFunction(node)) return;
      if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression);
      node.forEachChild(returnStep);
    };
    returnStep(runner.node);
    for (const returned of returns) {
      const text = returned.getText(source);
      if (!/(?:encoded|result)/i.test(text) || /(?:lease|acquired|port)/i.test(text) || isFunction(returned)) {
        found.push({
          subject: "escape",
          path,
          line: lineOf(source, returned),
          fingerprint: `return:${returned.pos}`,
          message: "runner return is not visibly the already encoded data result"
        });
      }
    }
    return found;
  }
});
