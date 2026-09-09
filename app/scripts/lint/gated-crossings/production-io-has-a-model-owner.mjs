import ts from "typescript";

import { check } from "../shared/check.mjs";
import { productionSources } from "../shared/production.mjs";

const BROWSER_IO = new Set([
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "fetch",
  "WebSocket",
  "EventSource",
  "BroadcastChannel"
]);
const EXTERNAL_IMPORT =
  /^(?:(?:node:)?(?:fs|fs\/promises|net|http|https|http2|tls|dgram|child_process)|@supabase\/|better-sqlite3$|mongodb$|mysql2?$|pg$|postgres$|undici$|axios$)/;

const modelOwned = (tree, path) =>
  tree.within(tree.path("model", "client"), path) || tree.within(tree.path("model", "server"), path);

const browserIoIn = (tree, path) => {
  const found = new Map();
  for (const script of tree.scripts(path)) {
    const visit = (node) => {
      if (ts.isIdentifier(node) && BROWSER_IO.has(node.text)) {
        const parent = node.parent;
        const usedAsGlobal =
          (ts.isCallExpression(parent) && parent.expression === node) ||
          (ts.isNewExpression(parent) && parent.expression === node) ||
          (ts.isPropertyAccessExpression(parent) && parent.expression === node) ||
          (ts.isElementAccessExpression(parent) && parent.expression === node);
        if (usedAsGlobal && !found.has(node.text)) {
          found.set(node.text, tree.scriptLine(path, script, node));
        }
      }
      node.forEachChild(visit);
    };
    visit(script.source);
  }
  return found;
};

export default check({
  id: "EDGE-03",
  pillar: "gated-crossings",
  finding: "ARCH-11",
  name: "production-io-has-a-model-owner",
  says: "Production persistence, network, and process I/O appears only beneath the client/server model that owns its policy and lifetime.",
  run(tree) {
    const found = [];
    for (const path of productionSources(tree)) {
      if (modelOwned(tree, path)) continue;
      const APIs = browserIoIn(tree, path);
      const imports = tree.imports(path).filter((record) => EXTERNAL_IMPORT.test(record.specifier));
      if (APIs.size === 0 && imports.length === 0) continue;
      const names = [...APIs.keys(), ...imports.map((record) => record.specifier)].sort();
      const lines = [...APIs.values(), ...imports.map((record) => record.line)].filter(Boolean);
      found.push({
        path,
        line: lines.length === 0 ? 1 : Math.min(...lines),
        fingerprint: names.join(","),
        message: `external I/O bypasses a model owner: ${names.join(", ")}`
      });
    }
    return found;
  }
});
