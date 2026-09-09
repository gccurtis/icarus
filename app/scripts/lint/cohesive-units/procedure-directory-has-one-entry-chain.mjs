import { basename, dirname, join } from "node:path";

import { check } from "../shared/check.mjs";
import { productionSources } from "../shared/production.mjs";
import { procedureEntries } from "./procedure-directory-has-one-entry-chain/effects.mjs";

const MAX_PURE_FAMILY = 8;

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
    "one-entry": "one file or directory names one effectful public procedure intent",
    "pure-family": "a pure helper family has a deliberately small public surface",
    "shared-is-shared": "shared procedure code has more than one real caller"
  },
  run(tree) {
    const found = [];
    const files = procedureRoots(tree);
    for (const path of files) {
      const relative = tree.rel(path);
      if (relative.includes("/test/") || relative.includes("/shared/")) continue;
      const entries = procedureEntries(tree, path);
      if (entries.effects.length > 1) {
        found.push({
          subject: "one-entry",
          path,
          fingerprint: entries.entries.join(","),
          message:
            `procedure source exposes ${entries.effects.length} effectful entry chains: ` +
            entries.effects.join(", ")
        });
        continue;
      }
      if (entries.pure.length > MAX_PURE_FAMILY) {
        found.push({
          subject: "pure-family",
          path,
          fingerprint: entries.entries.join(","),
          message:
            `pure procedure family exposes ${entries.pure.length} public values; ` +
            `the bounded family limit is ${MAX_PURE_FAMILY}: ${entries.pure.join(", ")}`
        });
      }
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
