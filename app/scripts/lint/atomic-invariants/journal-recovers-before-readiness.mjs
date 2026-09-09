import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { executableContract } from "../shared/contracts.mjs";

export default check({
  id: "TXN-04",
  pillar: "atomic-invariants",
  finding: "ARCH-02",
  name: "journal-recovers-before-readiness",
  says: "The persistence model has a recovery entry and a restart contract that runs before server readiness.",
  subjects: {
    "recovery-entry": "the store owns durable journal recovery",
    "restart-contract": "every interruption phase is exercised before readiness"
  },
  run(tree) {
    const store = tree.path("model", "server", "store");
    const candidates = tree
      .under(join(store, "methods"))
      .filter((path) => /(?:journal|recover).*\.server\.ts$/.test(path));
    const entry = candidates.find((path) => /\b(?:recover|replay)\w*\s*(?:=|\()/.test(tree.read(path)));
    const contract = join(store, "test", "non-functional", "recovery.test.ts");
    const found = [];
    if (!entry) {
      found.push({
        subject: "recovery-entry",
        path: candidates[0] ?? store,
        fingerprint: "store-journal-recovery",
        message: "Store has no journal recover/replay procedure"
      });
    }
    if (!tree.isFile(contract) || !executableContract(tree.read(contract), ["restart", "failpoint"])) {
      found.push({
        subject: "restart-contract",
        path: tree.isFile(contract) ? contract : store,
        fingerprint: "store-restart-contract",
        message: "Store has no failpoint restart-recovery contract"
      });
    }
    return found;
  }
});
