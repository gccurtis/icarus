import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { executableContract } from "../shared/contracts.mjs";
import { capabilities } from "../shared/trees.mjs";

const commandsIn = (text) =>
  [...text.matchAll(/export\s+const\s+(\w+)\s*=\s*command\s*\(/g)].map((match) => match[1]).sort();

export default check({
  id: "AUTH-04",
  pillar: "scoped-authority",
  finding: "ARCH-01",
  name: "subject-write-proves-ownership",
  says: "Every browser-reachable subject command is named in an executable cross-project ownership contract.",
  run(tree) {
    const found = [];
    for (const capability of capabilities(tree)) {
      const remote = join(capability.path, "index.remote.ts");
      if (!tree.isFile(remote)) continue;
      const commands = commandsIn(tree.read(remote));
      if (commands.length === 0) continue;
      const contract = join(capability.path, "test", "non-functional", "ownership.test.ts");
      const text = tree.read(contract);
      const missing = commands.filter((command) => !new RegExp(`\\b${command}\\b`).test(text));
      if (
        tree.isFile(contract) &&
        executableContract(text, ["cross-project", ...commands]) &&
        missing.length === 0
      ) continue;
      found.push({
        path: tree.isFile(contract) ? contract : capability.path,
        fingerprint: commands.join(","),
        message: `no cross-project ownership contract covers commands: ${commands.join(", ")}`
      });
    }
    return found;
  }
});
