import { dirname } from "node:path";

import { check } from "../shared/check.mjs";
import { unresolvedPathsIn } from "../shared/docs.mjs";

export default check({
  name: "documented-paths-resolve",
  says: "Where a concern document names a path, that path exists.",
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("views"))) {
      if (!path.endsWith(".md")) continue;
      for (const { target, line } of unresolvedPathsIn(tree, path, dirname(path))) {
        found.push({ path, line, message: `names ${target}, which is not there` });
      }
    }
    return found;
  }
});
