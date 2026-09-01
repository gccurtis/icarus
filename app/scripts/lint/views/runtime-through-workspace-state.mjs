import { check } from "../shared/check.mjs";
import { viewLeaves } from "../shared/trees.mjs";

/**
 * Attaching is what makes a second edit buffer. A view asks workspace state
 * which runtime a resource already has; it never asks for one of its own.
 */
const ATTACHES = /\b(attach|acquire|createRuntime|resourceRuntimes\.attach)\s*\(/;
const RUNTIMES = ["client", "resource-runtimes"];

export default check({
  name: "runtime-through-workspace-state",
  says: "No view attaches a resource runtime itself — two attachments to one resource is two edit buffers.",
  run(tree) {
    const found = [];
    for (const { path } of viewLeaves(tree)) {
      for (const record of tree.imports(path)) {
        const target = tree.aliasTarget(record.specifier);
        if (target?.tree !== "model") continue;
        if (RUNTIMES.some((part, index) => target.segments[index] !== part)) continue;
        found.push({
          path,
          line: record.line,
          message: `reaches the runtime register directly: ${record.specifier}`
        });
      }

      const text = tree.read(path);
      const match = text.match(ATTACHES);
      if (!match) continue;
      found.push({
        path,
        line: text.slice(0, match.index).split("\n").length,
        message: `calls ${match[0].trim()}, which is workspace state's to do`
      });
    }
    return found;
  }
});
