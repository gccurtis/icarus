import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { capabilities } from "../shared/trees.mjs";

const RAW_PROPERTY =
  /\b(?:readonly\s+)?(?:table|tableName|path|storePath)\??\s*:\s*(?:TableName|StorePath|string)\b/;

export default check({
  id: "AUTH-03",
  pillar: "scoped-authority",
  finding: "ARCH-01",
  name: "browser-capabilities-hide-persistence-coordinates",
  says: "Browser-reachable capability input types use domain intent rather than raw store tables or paths.",
  run(tree) {
    const found = [];
    for (const capability of capabilities(tree)) {
      if (!tree.isFile(join(capability.path, "index.remote.ts"))) continue;
      for (const path of tree.under(join(capability.path, "types")).filter((file) => file.endsWith(".ts"))) {
        const reachesStore = tree.imports(path).some((record) =>
          /\$(?:model\/server\/store|representation\/store)/.test(record.specifier)
        );
        const raw = tree.read(path).match(RAW_PROPERTY);
        if (!reachesStore && !raw) continue;
        found.push({
          path,
          line: raw ? tree.read(path).slice(0, raw.index).split("\n").length : 1,
          fingerprint: "raw-persistence-input",
          message: "remote input exposes persistence table/path coordinates instead of a subject command"
        });
      }
    }
    return found;
  }
});
