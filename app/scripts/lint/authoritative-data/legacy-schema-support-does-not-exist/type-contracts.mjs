import { retiredMembersIn, missingRequiredMembersIn, invalidRequiredLiteralMembersIn } from "./type-contracts/fields.mjs";
import { resourceContractIn, boundToContractIn } from "./type-contracts/resources.mjs";
import { slideDeckOpContractIn, formulaContractIn, promptBlockContractIn } from "./type-contracts/content.mjs";
import { semanticMaterialContractIn, materialDescriptorContractIn, derivedOutputLifecycleContractIn, semanticJobLifecycleContractIn } from "./type-contracts/semantic.mjs";
import { messageContractIn, agentContractIn, automationContractIn, researchTurnContractIn } from "./type-contracts/agents.mjs";

export const typeContractMarkersIn = (node, path, found) => {
  retiredMembersIn(node, found);
  missingRequiredMembersIn(node, found);
  invalidRequiredLiteralMembersIn(node, found);
  resourceContractIn(node, path, found);
  messageContractIn(node, path, found);
  semanticMaterialContractIn(node, path, found);
  formulaContractIn(node, path, found);
  promptBlockContractIn(node, path, found);
  boundToContractIn(node, path, found);
  slideDeckOpContractIn(node, path, found);
  materialDescriptorContractIn(node, path, found);
  derivedOutputLifecycleContractIn(node, path, found);
  semanticJobLifecycleContractIn(node, path, found);
  agentContractIn(node, path, found);
  automationContractIn(node, path, found);
  researchTurnContractIn(node, path, found);
};
