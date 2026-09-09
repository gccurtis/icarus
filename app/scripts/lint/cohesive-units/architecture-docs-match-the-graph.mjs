import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { capabilities, objects } from "../shared/trees.mjs";

export default check({
  id: "COH-04",
  pillar: "cohesive-units",
  finding: "ARCH-13",
  name: "architecture-docs-match-the-graph",
  says: "Root architecture documents name the graph that exists and do not retain source-contradicted forward declarations.",
  subjects: {
    "capability-inventory": "the capability overview names every capability",
    "server-inventory": "the server overview names every server model",
    "workspace-status": "workspace persistence prose matches its methods",
    "runtime-status": "runtime implementation prose matches its capability calls"
  },
  run(tree) {
    const found = [];
    const capabilityDoc = tree.path("capabilities", "capabilities.md");
    const capabilityText = tree.read(capabilityDoc);
    const unnamedCapabilities = capabilities(tree)
      .map(({ name }) => name)
      .filter((name) => !capabilityText.includes(name));
    if (unnamedCapabilities.length > 0) {
      found.push({
        subject: "capability-inventory",
        path: capabilityDoc,
        fingerprint: unnamedCapabilities.join(","),
        message: `capability overview omits: ${unnamedCapabilities.join(", ")}`
      });
    }

    const serverDoc = tree.path("runtime", "server", "server.md");
    const serverText = tree.read(serverDoc);
    const unnamedModels = objects(tree)
      .filter(({ environment }) => environment === "server")
      .map(({ name }) => name)
      .filter((name) => !serverText.includes(name));
    if (unnamedModels.length > 0) {
      found.push({
        subject: "server-inventory",
        path: serverDoc,
        fingerprint: unnamedModels.join(","),
        message: `server overview omits model objects: ${unnamedModels.join(", ")}`
      });
    }

    const workspace = tree.path("model", "client", "workspace-state");
    const workspaceDoc = join(workspace, "workspace-state.md");
    const hasPersistence = ["restore", "flush"].every((name) =>
      tree.under(join(workspace, "methods")).some((path) => basenameWithoutExtension(path) === name)
    );
    if (hasPersistence && /nothing here is persisted yet|no restore path/i.test(tree.read(workspaceDoc))) {
      found.push({
        subject: "workspace-status",
        path: workspaceDoc,
        fingerprint: "stale-unpersisted-claim",
        message: "workspace documentation says persistence/restore is absent while flush and restore methods exist"
      });
    }

    for (const runtime of objects(tree).filter(
      ({ environment, name }) => environment === "client" && name.endsWith("-runtimes")
    )) {
      const doc = join(runtime.path, `${runtime.name}.md`);
      const methods = tree.under(join(runtime.path, "methods"));
      const writes = methods.some((path) =>
        tree.imports(path).some((record) => record.specifier.startsWith("$capabilities/"))
      );
      if (!writes || !/writing is not|buffer is not filled yet/i.test(tree.read(doc))) continue;
      found.push({
        subject: "runtime-status",
        path: doc,
        fingerprint: runtime.name,
        message: `${runtime.name} documentation says writing is unbuilt while its methods call a capability`
      });
    }
    return found;
  }
});

const basenameWithoutExtension = (path) => path.split("/").at(-1)?.replace(/\.ts$/, "");
