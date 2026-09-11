import { basename, dirname, join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  recordProperty,
  registryDeclaration,
  registryRecords,
  stringValue
} from "../shared/capability-registry.mjs";
import {
  callPath,
  lineOf,
  literalStrings,
  propertyValue,
  staticName,
  unwrap,
  visit
} from "../shared/pure-contract.mjs";
import { objects } from "../shared/trees.mjs";

const modelCommitModes = (tree) => {
  const found = new Map();
  for (const { name, path: root } of objects(tree)) {
    const path = join(root, "port.ts");
    if (!tree.isFile(path)) continue;
    const source = tree.source(path);
    visit(source, (node) => {
      if (found.has(name) || !ts.isPropertyAssignment(node) || staticName(node.name) !== "commitMode") return;
      const value = unwrap(node.initializer);
      if (ts.isStringLiteral(value)) found.set(name, value.text);
    });
  }
  return found;
};

const operationSource = (tree, record) => {
  const [owner, operation] = record.name.split(".");
  return tree.path("capabilities", owner, "api", operation, `${operation}.ts`);
};

const explicitCommits = (tree, record) => {
  const entry = operationSource(tree, record);
  const root = dirname(entry);
  if (!tree.exists(root)) return [];
  const found = [];
  for (const path of tree.under(root).filter((file) => file.endsWith(".ts"))) {
    const source = tree.source(path);
    visit(source, (node) => {
      if (!ts.isCallExpression(node)) return;
      const parts = callPath(node.expression);
      if (parts?.at(-1) === "commit") found.push({ path, source, node, parts });
    });
  }
  return found;
};

const hasUnsafeCommitAncestor = (call) => {
  let node = call.parent;
  while (node) {
    if (
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)
    ) return node;
    if (ts.isFunctionLike(node)) return null;
    node = node.parent;
  }
  return null;
};

export default check({
  name: "one-staged-commit-owner",
  baseline: false,
  says: "Each invocation has at most one staged commit owner and every explicit durable checkpoint is statically named.",
  subjects: {
    duplicate: "a registry operation acquires each named model at most once",
    atomicity: "automatic work declares no more than one staged model",
    metadata: "commit modes come from model adapter literals and cannot be invented by registry",
    checkpoint: "explicit commit calls belong to a checkpointed operation with stable names",
    static: "commit is direct and cannot hide behind aliases, loops, recursion, or callbacks"
  },
  run(tree) {
    const found = [];
    const declaration = registryDeclaration(tree);
    const modes = modelCommitModes(tree);

    for (const record of registryRecords(declaration)) {
      const modelsNode = propertyValue(recordProperty(record, "models"));
      const models = literalStrings(modelsNode);
      if (!models) continue;
      const duplicates = models.filter((name, index) => models.indexOf(name) !== index);
      if (duplicates.length > 0) {
        found.push({
          subject: "duplicate",
          path: declaration.path,
          line: lineOf(declaration.source, recordProperty(record, "models") ?? record.property),
          fingerprint: `${record.name}:duplicates:${duplicates.join(",")}`,
          message: `${record.name} acquires duplicate model ${[...new Set(duplicates)].join(", ")}`
        });
      }

      const unresolved = models.filter((name) => !modes.has(name));
      if (unresolved.length > 0) {
        found.push({
          subject: "metadata",
          path: declaration.path,
          line: lineOf(declaration.source, recordProperty(record, "models") ?? record.property),
          fingerprint: `${record.name}:unknown-modes:${unresolved.join(",")}`,
          message: `${record.name} names model adapters without literal port commit modes: ${unresolved.join(", ")}`
        });
      }
      const staged = models.filter((name) => modes.get(name) === "staged");
      if (staged.length > 1) {
        found.push({
          subject: "atomicity",
          path: declaration.path,
          line: lineOf(declaration.source, recordProperty(record, "models") ?? record.property),
          fingerprint: `${record.name}:staged:${staged.join(",")}`,
          message: `${record.name} has multiple staged commit owners (${staged.join(", ")}); use one composite owner`
        });
      }

      const policy = stringValue(propertyValue(recordProperty(record, "commit")));
      const checkpoints = literalStrings(propertyValue(recordProperty(record, "checkpoints"))) ?? [];
      const commits = explicitCommits(tree, record);
      if (commits.length > 0 && policy !== "checkpointed") {
        for (const commit of commits) {
          found.push({
            subject: "checkpoint",
            path: commit.path,
            line: lineOf(commit.source, commit.node),
            fingerprint: `${record.name}:undeclared-commit:${commit.node.pos}`,
            message: "explicit commit appears in an operation not declared checkpointed by the registry"
          });
        }
      }
      if (policy === "checkpointed" && (checkpoints.length !== commits.length || new Set(checkpoints).size !== checkpoints.length)) {
        found.push({
          subject: "checkpoint",
          path: declaration.path,
          line: lineOf(declaration.source, record.property),
          fingerprint: `${record.name}:checkpoint-count:${checkpoints.length}:${commits.length}`,
          message: `${record.name} declares ${checkpoints.length} stable checkpoints for ${commits.length} explicit commits`
        });
      }
      for (const commit of commits) {
        const direct = ts.isPropertyAccessExpression(commit.node.expression) && commit.parts.length >= 2;
        const unsafe = hasUnsafeCommitAncestor(commit.node);
        if (direct && !unsafe) continue;
        found.push({
          subject: "static",
          path: commit.path,
          line: lineOf(commit.source, unsafe ?? commit.node),
          fingerprint: `${record.name}:non-static-commit:${commit.node.pos}`,
          message: "commit must be a direct statically named port call outside loops and callback dispatch"
        });
      }
    }
    return found;
  }
});
