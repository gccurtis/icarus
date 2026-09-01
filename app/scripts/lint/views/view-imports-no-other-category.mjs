import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { viewLeaves } from "../shared/trees.mjs";

/**
 * A view under `categories/<c>/` may reach `general/` and no other category.
 *
 * A view two categories both need is copied into both, so that either can grow
 * its own nuance without the other's consent. Without this rule the first person
 * who needs one twice imports it, and the copy stops being a copy.
 */
export default check({
  name: "view-imports-no-other-category",
  says: "A category's views reach general/ and nothing in another category.",
  run(tree) {
    const root = tree.path("app-views", "categories");
    const found = [];

    for (const { category, path } of viewLeaves(tree)) {
      if (category === "general") continue;
      const mine = join(root, category);

      for (const record of tree.imports(path)) {
        const resolved = tree.resolve(record.specifier, path);
        if (!resolved || !tree.within(root, resolved)) continue;
        if (tree.within(mine, resolved)) continue;
        found.push({
          path,
          line: record.line,
          message: `reaches another category: ${record.specifier}`
        });
      }
    }
    return found;
  }
});
