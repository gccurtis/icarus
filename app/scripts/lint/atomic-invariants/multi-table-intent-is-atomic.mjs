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
    const shared = tree.path("model", "server", "store", "test", "non-functional", "atomicity.test.ts");
    const found = [];
    for (const entry of multiWriteEntries(tree)) {
      const relative = tree.rel(entry.path).replace(/^src\/lib\/capabilities\//, "");
      const [capabilityRoot, apiPath] = entry.path.replaceAll("\\", "/").split("/api/");
      const intent = apiPath?.split("/")[0];
      const local = intent
        ? join(capabilityRoot, "test", "non-functional", `${intent}-atomicity.test.ts`)
        : undefined;
      const localText = local === undefined ? "" : tree.read(local);
      const importsEntry = local !== undefined && tree.imports(local).some((record) =>
        tree.resolve(record.specifier, local) === entry.path
      );
      const coveredLocally =
        local !== undefined &&
        tree.isFile(local) &&
        importsEntry &&
        executableContract(localText, ["failpoint"]);
      const coveredCentrally =
        tree.isFile(shared) && executableContract(tree.read(shared), ["failpoint", relative]);
      if (coveredLocally || coveredCentrally) continue;
      found.push({
        path: local !== undefined && tree.isFile(local) ? local : entry.path,
        fingerprint: relative,
        message: `no importing failpoint contract proves all-or-none persistence for ${relative}`
      });
    }
    return found;
  }
});
