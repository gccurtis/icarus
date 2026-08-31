import { basename } from "node:path";

import { check } from "../shared/check.mjs";

export default check({
  name: "framework-only-at-the-root",
  says: "Only start* imports $app/*. An object taking its identity from ambient routing is one that cannot be built twice.",
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("runtime"))) {
      if (!/\.(ts|js)$/.test(path) || path.includes("/test/")) continue;
      if (basename(path).startsWith("start.")) continue;
      // The one file whose subject is the request. Identity comes from the
      // caller and can come from nowhere else, and it builds nothing.
      if (basename(path) === "scope.server.ts") continue;

      for (const record of tree.imports(path)) {
        if (!record.specifier.startsWith("$app/")) continue;
        found.push({
          path,
          line: record.line,
          message: `takes its identity from ambient routing: ${record.specifier}`
        });
      }
    }
    return found;
  }
});
