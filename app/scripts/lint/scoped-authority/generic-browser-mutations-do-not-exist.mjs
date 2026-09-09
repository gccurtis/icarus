import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { capabilities } from "../shared/trees.mjs";

const RAW_TYPES =
  /\b(?:TableName|StorePath)\b|\b(?:readonly\s+)?(?:table|tableName|path|storePath)\??\s*:/;

export default check({
  id: "AUTH-06",
  pillar: "scoped-authority",
  finding: "ARCH-01",
  name: "generic-browser-mutations-do-not-exist",
  says: "The ordinary browser surface exports no command that is generic over persistence subjects.",
  run(tree) {
    const found = [];
    for (const capability of capabilities(tree)) {
      const remote = join(capability.path, "index.remote.ts");
      if (!tree.isFile(remote)) continue;
      const typeText = tree
        .under(join(capability.path, "types"))
        .filter((path) => path.endsWith(".ts"))
        .map((path) => tree.read(path))
        .join("\n");
      if (!RAW_TYPES.test(typeText)) continue;
      for (const match of tree.read(remote).matchAll(/export\s+const\s+(\w+)\s*=\s*command\s*\(/g)) {
        found.push({
          path: remote,
          line: tree.read(remote).slice(0, match.index).split("\n").length,
          fingerprint: match[1],
          message: `${match[1]} is a browser command generic over raw persistence coordinates`
        });
      }
    }
    return found;
  }
});
