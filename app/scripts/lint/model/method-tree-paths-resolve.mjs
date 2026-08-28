import { dirname } from "node:path";

import { check } from "../shared/check.mjs";
import { unresolvedPathsIn } from "../shared/docs.mjs";
import { objects } from "../shared/trees.mjs";

export default check({
  name: "method-tree-paths-resolve",
  says: "Where a method document draws a call tree, every path in it exists.",
  run(tree) {
    const found = [];
    for (const { path } of objects(tree)) {
      for (const document of tree.under(path)) {
        if (!document.endsWith(".md")) continue;
        for (const { target, line } of unresolvedPathsIn(tree, document, dirname(document))) {
          found.push({ path: document, line, message: `names ${target}, which is not there` });
        }
      }
    }
    return found;
  }
});
