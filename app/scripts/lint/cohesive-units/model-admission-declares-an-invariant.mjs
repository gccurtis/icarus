import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { objects } from "../shared/trees.mjs";

const REQUIREMENTS = [
  ["ownership", /##\s+Ownership(?:\s+Boundary)?/i],
  ["lifetime", /##\s+Lifetime/i],
  ["invariants", /##\s+Invariants?/i]
];

export default check({
  id: "COH-05",
  pillar: "cohesive-units",
  finding: "ARCH-11",
  name: "model-admission-declares-an-invariant",
  says: "Every model object documents its owner boundary, lifetime, and invariant before the runtime may construct it.",
  run(tree) {
    const found = [];
    for (const object of objects(tree)) {
      const doc = join(object.path, `${object.name}.md`);
      const text = tree.read(doc);
      const missing = REQUIREMENTS.filter(([, pattern]) => !pattern.test(text)).map(([name]) => name);
      if (tree.isFile(doc) && missing.length === 0) continue;
      found.push({
        path: tree.isFile(doc) ? doc : object.path,
        fingerprint: `${object.id}:${missing.join(",")}`,
        message: `${object.id} model contract is missing: ${missing.join(", ")}`
      });
    }
    return found;
  }
});
