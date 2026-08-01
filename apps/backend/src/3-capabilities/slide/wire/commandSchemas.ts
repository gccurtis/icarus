import type {
  SlideCommand,
  SlideCommandRequest,
  SlideOrigin
} from "../domain/model.js";
import {
  operationIntroducesPromptContent,
  operationIsInternalOnly
} from "../domain/tree.js";
import {
  assertSlideWireInput,
  decodeSlideOperations,
  exactKeys,
  requireNonNegativeInteger,
  requireRecord,
  requireString,
  SlideWireError
} from "./operationSchemas.js";
import {
  decodeContextEntries,
  decodePlacement,
  decodePresentation,
  decodeShapeFrame,
  decodeShapeTransform,
  decodeSlideCanvas,
  decodeSlideStyleRegistry,
  decodeTextBox,
  requireIdentifier,
  requireText
} from "./valueSchemas.js";

const ORIGINS = ["interactive", "agent", "automation"] as const satisfies readonly SlideOrigin[];
export const decodeSlideCommand = (value: unknown): SlideCommandRequest => {
  assertSlideWireInput(value, "Slide command request");
  const envelope = requireRecord(value, "Slide command request");
  exactKeys(envelope, ["requestId", "origin", "command"], "Slide command request");
  const requestId = requireIdentifier(envelope.requestId, "requestId");
  const origin = requireString(envelope.origin, "origin") as SlideOrigin;
  if (!(ORIGINS as readonly string[]).includes(origin)) {
    throw new SlideWireError(`Unknown origin: ${origin}`);
  }

  const raw = requireRecord(envelope.command, "command");
  const type = requireString(raw.type, "command.type") as SlideCommand["type"];
  let command: SlideCommand;

  switch (type) {
    case "deck.create":
      exactKeys(raw, ["type", "deckId", "title", "initialSlideId", "canvas", "styles"], type);
      command = {
        type,
        deckId: requireIdentifier(raw.deckId, "deckId"),
        title: requireString(raw.title, "title"),
        initialSlideId: requireIdentifier(raw.initialSlideId, "initialSlideId"),
        ...(raw.canvas !== undefined
          ? { canvas: decodeSlideCanvas(raw.canvas, "canvas") }
          : {}),
        ...(raw.styles !== undefined
          ? { styles: decodeSlideStyleRegistry(raw.styles, "styles") }
          : {})
      };
      break;
    case "deck.submit": {
      exactKeys(raw, ["type", "deckId", "expectedRevision", "operations"], type);
      const operations = decodeSlideOperations(raw.operations);
      const internal = operations.find(operationIsInternalOnly);
      if (internal) {
        throw new SlideWireError(`${internal.type} is an internal-only operation`);
      }
      const callerSuppliedPromptContent = operations.some(operationIntroducesPromptContent);
      if (callerSuppliedPromptContent) {
        throw new SlideWireError(
          "Prompt Content Shapes must be created through prompt-content.create.request"
        );
      }
      command = {
        type,
        deckId: requireIdentifier(raw.deckId, "deckId"),
        expectedRevision: requireNonNegativeInteger(raw.expectedRevision, "expectedRevision"),
        operations
      };
      break;
    }
    case "deck.compensate": {
      exactKeys(raw, ["type", "deckId", "targetChangeSetId", "intent", "expectedRevision"], type);
      const intent = requireString(raw.intent, "intent");
      if (intent !== "undo" && intent !== "redo") {
        throw new SlideWireError("intent must be undo or redo");
      }
      command = {
        type,
        deckId: requireIdentifier(raw.deckId, "deckId"),
        targetChangeSetId: requireIdentifier(raw.targetChangeSetId, "targetChangeSetId"),
        intent,
        expectedRevision: requireNonNegativeInteger(raw.expectedRevision, "expectedRevision")
      };
      break;
    }
    case "prompt-content.create.request":
      exactKeys(raw, [
        "type",
        "deckId",
        "expectedRevision",
        "slideId",
        "shapeId",
        "frame",
        "transform",
        "styleId",
        "presentation",
        "textBox",
        "placement",
        "prompt",
        "contextEntries",
        "stabilisationText"
      ], type);
      command = {
        type,
        deckId: requireIdentifier(raw.deckId, "deckId"),
        expectedRevision: requireNonNegativeInteger(raw.expectedRevision, "expectedRevision"),
        slideId: requireIdentifier(raw.slideId, "slideId"),
        shapeId: requireIdentifier(raw.shapeId, "shapeId"),
        frame: decodeShapeFrame(raw.frame, "frame"),
        ...(raw.transform !== undefined
          ? { transform: decodeShapeTransform(raw.transform, "transform") }
          : {}),
        styleId: requireIdentifier(raw.styleId, "styleId"),
        ...(raw.presentation !== undefined
          ? { presentation: decodePresentation(raw.presentation, "presentation") }
          : {}),
        textBox: decodeTextBox(raw.textBox, "textBox"),
        placement: decodePlacement(raw.placement, "placement"),
        prompt: requireString(raw.prompt, "prompt"),
        contextEntries: decodeContextEntries(raw.contextEntries, "contextEntries"),
        stabilisationText: requireText(raw.stabilisationText, "stabilisationText")
      };
      break;
    case "prompt-content.update-definition":
      exactKeys(raw, [
        "type",
        "deckId",
        "promptContentShapeId",
        "expectedDefinitionRevision",
        "prompt",
        "contextEntries",
        "stabilisationText"
      ], type);
      command = {
        type,
        deckId: requireIdentifier(raw.deckId, "deckId"),
        promptContentShapeId: requireIdentifier(
          raw.promptContentShapeId,
          "promptContentShapeId"
        ),
        expectedDefinitionRevision: requireNonNegativeInteger(
          raw.expectedDefinitionRevision,
          "expectedDefinitionRevision"
        ),
        prompt: requireString(raw.prompt, "prompt"),
        contextEntries: decodeContextEntries(raw.contextEntries, "contextEntries"),
        stabilisationText: requireText(raw.stabilisationText, "stabilisationText")
      };
      break;
    case "prompt-content.refresh.request":
      exactKeys(raw, [
        "type",
        "deckId",
        "promptContentShapeId",
        "expectedRevision"
      ], type);
      command = {
        type,
        deckId: requireIdentifier(raw.deckId, "deckId"),
        promptContentShapeId: requireIdentifier(
          raw.promptContentShapeId,
          "promptContentShapeId"
        ),
        expectedRevision: requireNonNegativeInteger(raw.expectedRevision, "expectedRevision")
      };
      break;
    default:
      throw new SlideWireError(`Unknown Slide command: ${type}`);
  }

  return { requestId, origin, command };
};
