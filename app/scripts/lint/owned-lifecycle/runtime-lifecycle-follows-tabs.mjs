import ts from "typescript";

import { check } from "../shared/check.mjs";
import { productionSources } from "../shared/production.mjs";

const ALLOWED = new Set([
  "src/lib/runtime/client/start.ts",
  "src/lib/model/client/workspace-state/methods/shared/apply.ts",
  "src/lib/model/client/workspace-state/methods/shared/adopt.ts",
  "src/lib/model/client/workspace-state/methods/shared/acquire-runtime.ts",
  "src/lib/model/client/workspace-state/methods/shared/release-runtime.ts",
  "src/lib/model/client/workspace-state/methods/shared/reconcile-runtimes.ts"
]);
const LIFECYCLE = new Set(["attach", "acquire", "release", "releaseAll"]);
const LIFECYCLE_PROCEDURES = new Set(["acquireForTarget", "releaseForTarget", "reconcileRuntimes"]);

const runtimeVocabulary = (tree) => {
  const words = new Set(["runtime", "runtimes"]);
  for (const name of tree.dirsIn(tree.path("model", "client")).filter((part) => part.endsWith("-runtimes"))) {
    const subject = name.replace(/-runtimes$/, "");
    const parts = subject.split("-");
    for (const part of parts) {
      words.add(part);
      words.add(`${part}s`);
    }
    words.add(subject.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()));
  }
  return words;
};

const isRuntimeReceiver = (receiver, vocabulary) => {
  const words = receiver
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .match(/[a-z][a-z0-9]*/g) ?? [];
  return words.some((word) => vocabulary.has(word));
};

export default check({
  id: "LIFE-02",
  pillar: "owned-lifecycle",
  finding: "ARCH-03",
  name: "runtime-lifecycle-follows-tabs",
  says: "Only canonical workspace operation/adoption procedures and client shutdown change resource-register lifetime.",
  run(tree) {
    const found = [];
    const vocabulary = new Set([...runtimeVocabulary(tree)].map((word) => word.toLowerCase()));
    for (const path of productionSources(tree).filter((file) => file.endsWith(".ts"))) {
      if (ALLOWED.has(tree.rel(path))) continue;
      tree.eachNode(path, (node) => {
        if (!ts.isCallExpression(node)) return;
        if (ts.isIdentifier(node.expression) && LIFECYCLE_PROCEDURES.has(node.expression.text)) {
          found.push({
            path,
            line: tree.lineOf(path, node),
            fingerprint: `${node.expression.text}:direct`,
            message: `${node.expression.text} changes resource lifetime outside canonical workspace operation handling`
          });
          return;
        }
        if (!ts.isPropertyAccessExpression(node.expression)) return;
        const name = node.expression.name.text;
        if (!LIFECYCLE.has(name)) return;
        const receiver = node.expression.expression.getText(tree.source(path));
        if (!isRuntimeReceiver(receiver, vocabulary)) return;
        found.push({
          path,
          line: tree.lineOf(path, node),
          fingerprint: `${name}:${receiver}`,
          message: `${name} changes resource lifetime outside canonical workspace operation handling or client shutdown`
        });
      });
    }
    return found;
  }
});
