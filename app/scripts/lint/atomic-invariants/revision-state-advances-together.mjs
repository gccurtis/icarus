import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { executableContract } from "../shared/contracts.mjs";
import { capabilities } from "../shared/trees.mjs";

const isRevisionSubject = (tree, capability) => {
  const text = tree
    .under(join(capability.path, "api"))
    .filter((path) => path.endsWith(".ts"))
    .map((path) => tree.read(path))
    .join("\n");
  return /Snapshots/.test(text) && /ChangeSets/.test(text) && /revision/i.test(text);
};

export default check({
  id: "TXN-05",
  pillar: "atomic-invariants",
  finding: "ARCH-02",
  name: "revision-state-advances-together",
  says: "Every revision-bearing subject has an atomicity contract covering snapshot, change set, leader, and revision metadata.",
  run(tree) {
    const found = [];
    for (const capability of capabilities(tree).filter((candidate) => isRevisionSubject(tree, candidate))) {
      const contract = join(capability.path, "test", "non-functional", "revision-atomicity.test.ts");
      const concepts = ["snapshot", "change set", "leader", "revision", "failpoint"];
      const text = tree.read(contract);
      const missing = concepts.filter((concept) => !text.toLowerCase().includes(concept));
      if (tree.isFile(contract) && executableContract(text, concepts)) continue;
      found.push({
        path: tree.isFile(contract) ? contract : capability.path,
        fingerprint: capability.name,
        message: `${capability.name} has no revision atomicity contract covering ${missing.join(", ")}`
      });
    }
    return found;
  }
});
