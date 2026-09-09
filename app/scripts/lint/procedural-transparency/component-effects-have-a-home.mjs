import ts from "typescript";

import { check } from "../shared/check.mjs";
import { productionSvelte } from "../shared/production.mjs";

const LIFECYCLE = new Set(["$effect", "onMount", "onDestroy"]);

const lifecycleName = (node) => {
  if (!ts.isCallExpression(node)) return undefined;
  if (ts.isIdentifier(node.expression) && LIFECYCLE.has(node.expression.text)) {
    return node.expression.text;
  }
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "$effect" &&
    node.expression.name.text === "pre"
  ) return "$effect.pre";
  return undefined;
};

export default check({
  id: "BEH-02",
  pillar: "procedural-transparency",
  finding: "ARCH-05",
  name: "component-effects-have-a-home",
  says: "Lifecycle synchronization is named by a procedures/effects module rather than defined anonymously beside markup.",
  run(tree) {
    const found = [];
    for (const path of productionSvelte(tree)) {
      const calls = [];
      for (const script of tree.scripts(path)) {
        const visit = (node) => {
          const name = lifecycleName(node);
          if (name) calls.push({ name, line: tree.scriptLine(path, script, node) });
          node.forEachChild(visit);
        };
        visit(script.source);
      }
      if (calls.length === 0) continue;
      found.push({
        path,
        line: calls[0].line,
        fingerprint: calls.map((call) => call.name).sort().join(","),
        message: `${calls.length} inline lifecycle call${calls.length === 1 ? "" : "s"} (${calls.map((call) => call.name).join(", ")}); move each synchronization to procedures/effects/`
      });
    }
    return found;
  }
});
