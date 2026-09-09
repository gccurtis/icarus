import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { executableContract } from "../shared/contracts.mjs";
import { objects } from "../shared/trees.mjs";

export default check({
  id: "DATA-04",
  pillar: "authoritative-data",
  finding: "ARCH-04",
  name: "resource-id-selects-the-rendered-body",
  says: "Each resource editor visibly connects workspace resourceId to a subject Runtime body and a Chromium identity contract.",
  subjects: {
    "source-flow": "the production content reads resource identity and runtime body",
    "chromium-contract": "two seeded identities are proved distinct in Chromium"
  },
  run(tree) {
    const found = [];
    const contract = join(tree.base, "test", "browser", "resource-identity.spec.ts");
    const contractText = tree.read(contract);
    for (const runtime of objects(tree).filter(
      (object) => object.environment === "client" && object.name.endsWith("-runtimes")
    )) {
      const subject = runtime.name.replace(/-runtimes$/, "");
      const category = `${subject}-editor`;
      const content = tree.path("app-views", "categories", category, "content");
      const text = tree
        .under(content)
        .filter((path) => path.endsWith(".svelte"))
        .map((path) => tree.read(path))
        .join("\n");
      const missing = [
        !/resourceId/.test(text) ? "resourceId" : "",
        !/\b\w+Runtime\b/.test(text) ? "subject Runtime" : "",
        !/\.body\b/.test(text) ? "runtime.body" : ""
      ].filter(Boolean);
      if (missing.length > 0) {
        found.push({
          subject: "source-flow",
          path: tree.exists(content) ? content : runtime.path,
          fingerprint: subject,
          message: `${category} does not connect ${missing.join(", ")} into its rendered body`
        });
      }
      if (!tree.isFile(contract) || !executableContract(contractText, [category])) {
        found.push({
          subject: "chromium-contract",
          path: tree.isFile(contract) ? contract : runtime.path,
          fingerprint: subject,
          message: `resource identity Chromium contract does not cover ${category}`
        });
      }
    }
    return found;
  }
});
