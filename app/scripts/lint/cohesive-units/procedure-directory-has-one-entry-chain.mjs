import { basename, dirname, join } from "node:path";

import { check } from "../shared/check.mjs";
import { productionSources, valueExports } from "../shared/production.mjs";

const procedureRoots = (tree) =>
  [tree.path("app-views"), tree.path("surfaces")]
    .flatMap((root) => tree.under(root))
    .filter((path) => path.endsWith(".ts") && tree.rel(path).includes("/procedures/"));

export default check({
  id: "COH-02",
  pillar: "cohesive-units",
  finding: "ARCH-12",
  name: "procedure-directory-has-one-entry-chain",
  says: "A view procedure file exposes one entry intent, subdirectories have matching entries, and shared steps have multiple consumers.",
  subjects: {
    "one-entry": "one file or directory names one public procedure intent",
    "shared-is-shared": "shared procedure code has more than one real caller"
  },
  run(tree) {
    const found = [];
    const files = procedureRoots(tree);
    for (const path of files) {
      const relative = tree.rel(path);
      if (relative.includes("/test/") || relative.includes("/shared/")) continue;
      const exports = valueExports(tree, path);
      if (exports.length <= 1) continue;
      found.push({
        subject: "one-entry",
        path,
        fingerprint: exports.sort().join(","),
        message: `procedure source exposes ${exports.length} entry values: ${exports.join(", ")}`
      });
    }

    const roots = new Set(files.map((path) => tree.rel(path).split("/procedures/")[0]));
    for (const relativeRoot of roots) {
      const procedures = join(tree.base, relativeRoot, "procedures");
      for (const directory of tree.dirsIn(procedures).filter((name) => !["shared", "effects", "test"].includes(name))) {
        const path = join(procedures, directory);
        if (tree.isFile(join(path, `${directory}.ts`))) continue;
        found.push({
          subject: "one-entry",
          path,
          fingerprint: directory,
          message: `procedure directory has no ${directory}.ts entry`
        });
      }
    }

    const allSources = productionSources(tree);
    for (const path of files.filter((file) => tree.rel(file).includes("/procedures/shared/"))) {
      const consumers = allSources.filter((source) =>
        tree.imports(source).some((record) => tree.resolve(record.specifier, source) === path)
      );
      if (new Set(consumers.map((source) => dirname(source))).size >= 2) continue;
      found.push({
        subject: "shared-is-shared",
        path,
        fingerprint: basename(path),
        message: "shared procedure module has fewer than two distinct procedure consumers"
      });
    }
    return found;
  }
});
