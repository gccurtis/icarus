import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { executableContract } from "../shared/contracts.mjs";
import { multiWriteEntries } from "../shared/durable-mutations.mjs";

export default check({
  id: "TXN-03",
  pillar: "atomic-invariants",
  finding: "ARCH-02",
  name: "multi-table-intent-is-atomic",
  says: "Every multi-write capability intent is named by the Store fault-injection atomicity contract.",
  run(tree) {
    const contract = tree.path("model", "server", "store", "test", "non-functional", "atomicity.test.ts");
    const text = tree.read(contract);
    const found = [];
    for (const entry of multiWriteEntries(tree)) {
      const relative = tree.rel(entry.path).replace(/^src\/lib\/capabilities\//, "");
      if (tree.isFile(contract) && executableContract(text, ["failpoint", relative])) continue;
      found.push({
        path: tree.isFile(contract) ? contract : entry.path,
        fingerprint: relative,
        message: `Store failpoint contract does not prove all-or-none persistence for ${relative}`
      });
    }
    return found;
  }
});
