import ts from "typescript";

import { check } from "../shared/check.mjs";

const FRAMEWORK = /^(svelte|@sveltejs\/|\$app\/|\$env\/)/;
/** Reads that make the same call return two answers. */
const AMBIENT = new Map([
  ["Date", "the clock"],
  ["Math.random", "randomness"],
  ["performance", "the clock"],
  ["process", "the environment"],
  ["globalThis", "a global"],
  ["window", "a global"],
  ["document", "a global"],
  ["localStorage", "a global"],
  ["crypto", "a global"]
]);

export default check({
  name: "behavior-is-pure",
  says: "Same arguments, same answer, on either side of the boundary.",
  subjects: {
    "no-framework": "no Svelte, no SvelteKit, no rune",
    "no-node": "no node:*, so the file is loadable in a browser",
    "no-server-module": "nothing whose name marks it as the server's",
    "no-ambient-state": "no clock, no environment, no global read"
  },
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("representation", "data", "behavior"))) {
      if (!path.endsWith(".ts")) continue;

      if (tree.declaresRunes(path)) {
        found.push({ subject: "no-framework", path, message: "declares a rune" });
      }
      for (const record of tree.imports(path)) {
        const { specifier, line } = record;
        if (FRAMEWORK.test(specifier)) {
          found.push({ subject: "no-framework", path, line, message: `imports ${specifier}` });
        }
        if (specifier.startsWith("node:")) {
          found.push({ subject: "no-node", path, line, message: `imports ${specifier}` });
        }
        const resolved = tree.resolve(specifier, path);
        if (/\.server\.(ts|js)$/.test(specifier) || (resolved && /\.server\.(ts|js)$/.test(resolved))) {
          found.push({ subject: "no-server-module", path, line, message: `imports ${specifier}` });
        }
      }

      tree.eachNode(path, (node) => {
        if (!ts.isIdentifier(node)) return;
        if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) return;
        if (ts.isBindingElement(node.parent) || ts.isParameter(node.parent)) return;
        const what = AMBIENT.get(node.text);
        if (!what) return;
        found.push({
          subject: "no-ambient-state",
          path,
          line: tree.lineOf(path, node),
          message: `reads ${what} through ${node.text}`
        });
      });
    }
    return found;
  }
});
