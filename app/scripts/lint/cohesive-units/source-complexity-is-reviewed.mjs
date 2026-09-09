import ts from "typescript";

import { check } from "../shared/check.mjs";
import { productionSources, productionSvelte, valueExports } from "../shared/production.mjs";

const reviewed = (text) => /@architecture-complexity\s+reviewed\b/.test(text);
const generated = (text) => /@architecture-complexity\s+generated\b/.test(text);

const metricsOf = (tree, path, sources) => {
  let branches = 0;
  let lifecycle = 0;
  let state = 0;
  const visit = (node) => {
    if (
      ts.isIfStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isConditionalExpression(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCatchClause(node)
    ) branches += 1;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? `${callee.expression.getText()}.${callee.name.text}`
          : "";
      if (["$effect", "$effect.pre", "onMount", "onDestroy"].includes(name)) lifecycle += 1;
      if (name === "$state" || name.startsWith("$state.")) state += 1;
    }
    node.forEachChild(visit);
  };
  for (const source of sources) visit(source);
  return {
    imports: tree.imports(path).length,
    branches,
    lifecycle,
    state
  };
};

const vector = (metrics, exports) =>
  `${metrics.imports} imports · ${exports} exports · ${metrics.branches} branches · ` +
  `${metrics.lifecycle} lifecycle calls · ${metrics.state} state bindings`;

export default check({
  id: "COH-01",
  pillar: "cohesive-units",
  finding: "ARCH-05",
  name: "source-complexity-is-reviewed",
  says: "Large controller/procedure sources cross a visible review gate; unclassified hand-authored sources never exceed the hard ceiling.",
  run(tree) {
    const found = [];
    for (const path of productionSvelte(tree)) {
      const lines = tree.scripts(path).reduce(
        (total, script) => total + script.source.getFullText().split("\n").length,
        0
      );
      const hard = lines > 800;
      if (lines <= 300 || (!hard && reviewed(tree.read(path)))) continue;
      const scripts = tree.scripts(path).map(({ source }) => source);
      const metrics = metricsOf(tree, path, scripts);
      found.push({
        path,
        fingerprint: `svelte-script:${hard ? "over-800" : "over-300"}`,
        message:
          `${lines} component script lines (${vector(metrics, 0)}) require ` +
          `${hard ? "a split" : "an architecture-complexity review and split decision"}`
      });
    }
    for (const path of productionSources(tree).filter((file) => file.endsWith(".ts"))) {
      const relative = tree.rel(path);
      if (!/(?:\/procedures\/|\/api\/)/.test(relative)) continue;
      const text = tree.read(path);
      const lines = text.split("\n").length;
      const exports = valueExports(tree, path).length;
      const hard = lines > 800 && !generated(text);
      const review = (lines > 300 || exports > 20) && !reviewed(text) && !generated(text);
      if (!hard && !review) continue;
      const metrics = metricsOf(tree, path, [tree.source(path)]);
      found.push({
        path,
        fingerprint: `${hard ? "hand-authored-over-800" : "review"}:${exports > 20 ? "exports-over-20" : "lines-over-300"}`,
        message:
          `${lines} lines (${vector(metrics, exports)}) require ` +
          `${hard ? "a split or generated classification" : "an architecture-complexity review"}`
      });
    }
    return found;
  }
});
