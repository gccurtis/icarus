import type { DocumentSnapshot } from "../domain/model.js";
import { digestFormulaExpression } from "../domain/canonical.js";
import { forEachBlock } from "../domain/tree.js";

export interface DocumentDependenciesProjection {
  promptOutputs: Array<{ blockId: string; outputId: string; appliedRevision: number }>;
  formulas: Array<{ blockId: string; atomId: string; expressionDigest: string }>;
}

export const projectDocumentDependencies = (
  snapshot: DocumentSnapshot
): DocumentDependenciesProjection => {
  const promptOutputs: DocumentDependenciesProjection["promptOutputs"] = [];
  const formulas: DocumentDependenciesProjection["formulas"] = [];
  forEachBlock(snapshot, (block) => {
    if (block.kind === "prompt") {
      promptOutputs.push({
        blockId: block.id,
        outputId: block.output.outputId,
        appliedRevision: block.output.appliedRevision
      });
    } else if (block.kind === "text" || block.kind === "quote" || block.kind === "code") {
      for (const atom of block.content.atoms) {
        if (atom.kind === "formula") {
          formulas.push({
            blockId: block.id,
            atomId: atom.id,
            expressionDigest: digestFormulaExpression(atom.expression)
          });
        }
      }
    }
  });
  return { promptOutputs, formulas };
};
