import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { executableContract } from "../shared/contracts.mjs";
import { capabilities } from "../shared/trees.mjs";

const commandsIn = (text) =>
  [...text.matchAll(/export\s+const\s+(\w+)\s*=\s*command\s*\(/g)].map((match) => match[1]).sort();

const CONVERSATION_AGGREGATE = {
  representation: ["representation", "data", "behavior", "agents", "conversation.ts"],
  agents: ["capabilities", "agents", "api", "shared", "threads.ts"],
  agentsContract: ["capabilities", "agents", "test", "unit", "agents.test.ts"],
  research: ["capabilities", "research-chat", "api", "shared", "conversation.ts"],
  researchContract: ["capabilities", "research-chat", "test", "unit", "research-chat.test.ts"]
};

const missingConcepts = (text, concepts) =>
  concepts.filter((concept) => !text.includes(concept));

export default check({
  id: "AUTH-04",
  pillar: "scoped-authority",
  finding: "ARCH-01",
  name: "subject-write-proves-ownership",
  says: "Every browser-reachable subject command is named in an executable cross-project ownership contract.",
  run(tree) {
    const found = [];
    const aggregatePath = Object.fromEntries(
      Object.entries(CONVERSATION_AGGREGATE).map(([name, path]) => [name, tree.path(...path)])
    );
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

    const represented = tree.read(aggregatePath.representation);
    const representedMissing = missingConcepts(represented, [
      "storedFields(candidate)?._id === threadId",
      "storedFields(candidate)?.threadId === threadId",
      "thread.projectId !== projectId || thread.kind !== expectedKind",
      "part.projectId !== projectId",
      "new Set(parts.map((part) => part.part)).size !== parts.length"
    ]);
    if (representedMissing.length > 0) {
      found.push({
        path: aggregatePath.representation,
        fingerprint: "conversation-aggregate",
        message: `conversation aggregate omits exact ownership gates: ${representedMissing.join(", ")}`
      });
    }

    const agents = tree.read(aggregatePath.agents);
    const agentsContract = tree.read(aggregatePath.agentsContract);
    if (
      missingConcepts(agents, ["conversationAggregate(", "projectId", "threadId", "expectedKind"]).length > 0 ||
      !executableContract(agentsContract, ["current part claims", "another project", "structuredClone"])
    ) {
      found.push({
        path: aggregatePath.agentsContract,
        fingerprint: "agents-conversation-aggregate",
        message: "Agents conversation reads and appends lack an executable cross-project aggregate contract"
      });
    }

    const research = tree.read(aggregatePath.research);
    const researchContract = tree.read(aggregatePath.researchContract);
    if (
      missingConcepts(research, ["conversationAggregate(", "appendResearchMessage", "projectId", "researchThread"]).length > 0 ||
      !executableContract(researchContract, [
        "refuses reads when a current conversation part",
        "re-resolves the append aggregate inside its transaction",
        "refuses a cross-project part claimant",
        "rolls the entire deletion back"
      ])
    ) {
      found.push({
        path: aggregatePath.researchContract,
        fingerprint: "research-conversation-aggregate",
        message: "Research conversation read, append, and delete lack an executable aggregate ownership contract"
      });
    }
    return found;
  }
});
