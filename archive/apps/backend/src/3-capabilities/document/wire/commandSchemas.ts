import type { DocumentCommand, DocumentCommandRequest, DocumentOrigin } from "../domain/model.js";
import {
  assertDocumentWireInput,
  decodeDocumentOperations,
  DocumentWireError,
  exactKeys,
  requireNonNegativeInteger,
  requireRecord,
  requireString
} from "./operationSchemas.js";
import {
  decodePromptContext,
  decodePageLayout,
  decodePlacement,
  decodePresentation,
  decodeStyleRegistry,
  requireIdentifier,
  requireText,
} from "./valueSchemas.js";

const origins = new Set<DocumentOrigin>(["interactive", "agent", "automation"]);

export const decodeDocumentCommand = (value: unknown): DocumentCommandRequest => {
  assertDocumentWireInput(value, "Document command request");
  const envelope = requireRecord(value, "Document command request");
  exactKeys(envelope, ["requestId", "origin", "command"], "Document command request");
  const requestId = requireIdentifier(envelope.requestId, "requestId");
  const origin = requireString(envelope.origin, "origin") as DocumentOrigin;
  if (!origins.has(origin)) throw new DocumentWireError(`Unknown origin: ${origin}`);
  const raw = requireRecord(envelope.command, "command");
  const type = requireString(raw.type, "command.type") as DocumentCommand["type"];
  let command: DocumentCommand;

  switch (type) {
    case "document.create":
      // No documentId: the service allocates it. Supplying one is an unknown key
      // and therefore a 400, rather than a value that looks accepted and is not.
      exactKeys(raw, ["type", "title", "pageLayout", "styles"], type);
      command = {
        type,
        title: requireString(raw.title, "title"),
        ...(raw.pageLayout !== undefined ? { pageLayout: decodePageLayout(raw.pageLayout, "pageLayout") } : {}),
        ...(raw.styles !== undefined ? { styles: decodeStyleRegistry(raw.styles, "styles") } : {})
      };
      break;
    case "document.delete":
      exactKeys(raw, ["type", "documentId", "expectedRevision"], type);
      command = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        expectedRevision: requireNonNegativeInteger(raw.expectedRevision, "expectedRevision")
      };
      break;
    case "document.purge":
      exactKeys(raw, ["type", "documentId"], type);
      command = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId")
      };
      break;
    case "document.submit":
      exactKeys(raw, ["type", "documentId", "expectedRevision", "operations"], type);
      command = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        expectedRevision: requireNonNegativeInteger(raw.expectedRevision, "expectedRevision"),
        operations: decodeDocumentOperations(raw.operations)
      };
      break;
    case "document.compensate": {
      exactKeys(raw, ["type", "documentId", "targetChangeSetId", "intent", "expectedRevision"], type);
      const intent = requireString(raw.intent, "intent");
      if (intent !== "undo" && intent !== "redo") throw new DocumentWireError("intent must be undo or redo");
      command = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        targetChangeSetId: requireIdentifier(raw.targetChangeSetId, "targetChangeSetId"),
        intent,
        expectedRevision: requireNonNegativeInteger(raw.expectedRevision, "expectedRevision")
      };
      break;
    }
    case "prompt.create.request":
      exactKeys(raw, ["type", "documentId", "expectedRevision", "blockId", "styleId", "presentation", "placement", "prompt", "context", "stabilisationText"], type);
      command = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        expectedRevision: requireNonNegativeInteger(raw.expectedRevision, "expectedRevision"),
        blockId: requireIdentifier(raw.blockId, "blockId"),
        styleId: requireIdentifier(raw.styleId, "styleId"),
        ...(raw.presentation !== undefined ? { presentation: decodePresentation(raw.presentation, "presentation") } : {}),
        placement: decodePlacement(raw.placement, "placement"),
        prompt: requireString(raw.prompt, "prompt"),
        context: decodePromptContext(raw.context, "context"),
        stabilisationText: requireText(raw.stabilisationText, "stabilisationText")
      };
      break;
    case "prompt.update-definition":
      // No contextEntries: the Block already carries its context, and accepting
      // entries here gave two answers to "what is this grounded on".
      exactKeys(raw, ["type", "documentId", "promptBlockId", "expectedDefinitionRevision", "prompt", "stabilisationText"], type);
      command = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        promptBlockId: requireIdentifier(raw.promptBlockId, "promptBlockId"),
        expectedDefinitionRevision: requireNonNegativeInteger(raw.expectedDefinitionRevision, "expectedDefinitionRevision"),
        prompt: requireString(raw.prompt, "prompt"),
        stabilisationText: requireText(raw.stabilisationText, "stabilisationText")
      };
      break;
    case "prompt.refresh.request":
      exactKeys(raw, ["type", "documentId", "promptBlockId", "expectedRevision"], type);
      command = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        promptBlockId: requireIdentifier(raw.promptBlockId, "promptBlockId"),
        expectedRevision: requireNonNegativeInteger(raw.expectedRevision, "expectedRevision")
      };
      break;
    case "formula.evaluate.request":
      exactKeys(raw, ["type", "documentId", "blockId", "formulaAtomId"], type);
      command = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        blockId: requireIdentifier(raw.blockId, "blockId"),
        formulaAtomId: requireIdentifier(raw.formulaAtomId, "formulaAtomId")
      };
      break;
    default:
      throw new DocumentWireError(`Unknown Document command: ${type}`);
  }

  return {
    requestId,
    origin,
    command
  };
};
