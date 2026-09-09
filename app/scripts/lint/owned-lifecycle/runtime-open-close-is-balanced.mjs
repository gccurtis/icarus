import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { executableContract } from "../shared/contracts.mjs";

const runtimeObjects = (tree) =>
  tree
    .dirsIn(tree.path("model", "client"))
    .filter((name) => name.endsWith("-runtimes"))
    .map((name) => ({ name, path: tree.path("model", "client", name) }));

const workspaceText = (tree, parts) =>
  parts
    .flatMap((part) => {
      const methods = tree.path("model", "client", "workspace-state", "methods");
      const file = join(methods, `${part}.ts`);
      const directory = join(methods, part);
      return [...(tree.isFile(file) ? [file] : []), ...tree.under(directory)];
    })
    .filter((path) => path.endsWith(".ts"))
    .map((path) => tree.read(path))
    .join("\n");

export default check({
  id: "LIFE-04",
  pillar: "owned-lifecycle",
  finding: "ARCH-03",
  name: "runtime-open-close-is-balanced",
  says: "Every subject runtime is wired into workspace acquisition, last-tab release, and an executable lifecycle contract.",
  subjects: {
    "workspace-reaches-runtime": "workspace state knows the subject register",
    "open-acquires": "open/restore acquires the subject runtime",
    "close-releases": "close releases the subject runtime",
    "contract-exists": "a stateful lifecycle contract proves balance"
  },
  run(tree) {
    const found = [];
    const workspaceRoot = tree.path("model", "client", "workspace-state");
    const allWorkspace = tree.under(workspaceRoot).filter((path) => path.endsWith(".ts"));
    const openText = workspaceText(tree, ["open", "restore"]);
    const closeText = workspaceText(tree, ["close"]);
    const contract = join(workspaceRoot, "test", "non-functional", "runtime-lifecycle.test.ts");
    const contractText = tree.read(contract);

    for (const runtime of runtimeObjects(tree)) {
      const specifier = `$model/client/${runtime.name}`;
      const subject = runtime.name.replace(/-runtimes$/, "");
      const token = subject.split("-").at(-1);
      const reached = allWorkspace.some((path) =>
        tree.imports(path).some(
          (record) => record.specifier === specifier || record.specifier.startsWith(`${specifier}/`)
        )
      );
      if (!reached) {
        found.push({
          subject: "workspace-reaches-runtime",
          path: runtime.path,
          fingerprint: subject,
          message: `${subject} runtime register is not reachable from WorkspaceState`
        });
      }
      if (!new RegExp(`${token}s?[^\n]*(?:attach|acquire)`, "i").test(openText)) {
        found.push({
          subject: "open-acquires",
          path: runtime.path,
          fingerprint: subject,
          message: `workspace open/restore does not acquire the ${subject} runtime`
        });
      }
      if (!new RegExp(`${token}s?[^\n]*release`, "i").test(closeText)) {
        found.push({
          subject: "close-releases",
          path: runtime.path,
          fingerprint: subject,
          message: `workspace close does not release the ${subject} runtime`
        });
      }
      if (!tree.isFile(contract) || !executableContract(contractText, [subject])) {
        found.push({
          subject: "contract-exists",
          path: tree.isFile(contract) ? contract : workspaceRoot,
          fingerprint: subject,
          message: `runtime lifecycle contract does not cover ${subject}`
        });
      }
    }
    return found;
  }
});
