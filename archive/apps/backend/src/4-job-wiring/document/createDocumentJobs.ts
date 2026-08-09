import type { InternalJobDefinition } from "#utils/jobs/internalRuntime.js";
import type { DocumentCapability, DocumentInternalJobIntent } from "#document";

export const createDocumentInternalJob = (
  document: DocumentCapability,
  intent: DocumentInternalJobIntent
): InternalJobDefinition => {
  switch (intent.type) {
    case "document.compact":
      return {
        name: "documents.compact",
        queueType: "serial",
        work: () => document.compact(intent.documentId)
      };
    case "document.prompt.create.compute":
      return {
        name: "documents.prompt.create.compute",
        queueType: "concurrent",
        work: () => document.computePromptCreation(intent.attemptId)
      };
    case "document.prompt.create.settle":
      return {
        name: "documents.prompt.create.settle",
        queueType: "serial",
        work: () => document.settlePromptCreation(intent.attemptId)
      };
    case "document.prompt.refresh.compute":
      return {
        name: "documents.prompt.refresh.compute",
        queueType: "concurrent",
        work: () => document.computePromptRefresh(intent.attemptId)
      };
    case "document.prompt.refresh.settle":
      return {
        name: "documents.prompt.refresh.settle",
        queueType: "serial",
        work: () => document.settlePromptRefresh(intent.attemptId)
      };
    case "document.formula.evaluate.compute":
      return {
        name: "documents.formula.evaluate.compute",
        queueType: "concurrent",
        work: () => document.computeFormulaEvaluation(intent.attemptId)
      };
    case "document.formula.evaluate.settle":
      return {
        name: "documents.formula.evaluate.settle",
        queueType: "serial",
        work: () => document.settleFormulaEvaluation(intent.attemptId)
      };
  }
};
