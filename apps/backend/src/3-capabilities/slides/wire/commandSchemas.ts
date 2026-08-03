import type {
  SlideCommand,
  SlideCommandRequest,
  SlideOrigin
} from "../domain/model.js";
import {
  SlideWireError,
  assertSlideWireInput,
  decodeCanvas,
  decodeContextEntries,
  decodePromptCreateTarget,
  decodePromptSite,
  decodeRichContentTarget,
  exactKeys,
  requireEnum,
  requireIdentifier,
  requireNonNegativeInteger,
  requireRecord,
  requireString,
  requireText
} from "./valueSchemas.js";
import { decodeSlideOperations } from "./operationSchemas.js";

const SLIDE_ORIGINS = ["interactive", "agent", "automation"] as const satisfies
  readonly SlideOrigin[];

const COMMAND_KEYS: Record<SlideCommand["type"], readonly string[]> = {
  "deck.create": ["type", "title", "canvas"],
  "deck.submit": ["type", "deckId", "expectedRevision", "operations"],
  "deck.compensate": ["type", "deckId", "targetChangeSetId", "intent", "expectedRevision"],
  "deck.delete": ["type", "deckId", "expectedRevision"],
  "deck.purge": ["type", "deckId"],
  "prompt.create.request": [
    "type", "deckId", "expectedRevision", "target",
    "prompt", "contextEntries", "stabilisationText"
  ],
  "prompt.update-definition": [
    "type", "deckId", "site", "expectedDefinitionRevision",
    "prompt", "contextEntries", "stabilisationText"
  ],
  "prompt.refresh.request": ["type", "deckId", "site", "expectedRevision"],
  "formula.evaluate.request": ["type", "deckId", "target", "formulaAtomId"]
};

/** Every command type the decoder accepts. Exported so a test can assert parity. */
export const SLIDE_COMMAND_TYPES = Object.keys(COMMAND_KEYS) as SlideCommand["type"][];

const decodeCommand = (value: unknown): SlideCommand => {
  const raw = requireRecord(value, "command");
  const type = requireString(raw.type, "command.type") as SlideCommand["type"];
  const keys = COMMAND_KEYS[type];
  if (!keys) throw new SlideWireError(`Unknown Slides command: ${type}`);
  exactKeys(raw, keys, type);

  switch (type) {
    case "deck.create":
      // No Deck ID and no Slide ID: the service allocates both. A caller has no
      // basis on which to name something that does not exist yet.
      return {
        type,
        title: requireString(raw.title, `${type}.title`),
        ...(raw.canvas !== undefined
          ? { canvas: decodeCanvas(raw.canvas, `${type}.canvas`) }
          : {})
      };
    case "deck.submit":
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        expectedRevision: requireNonNegativeInteger(
          raw.expectedRevision,
          `${type}.expectedRevision`
        ),
        operations: decodeSlideOperations(raw.operations)
      };
    case "deck.compensate":
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        targetChangeSetId: requireIdentifier(
          raw.targetChangeSetId,
          `${type}.targetChangeSetId`
        ),
        intent: requireEnum(raw.intent, ["undo", "redo"] as const, `${type}.intent`),
        expectedRevision: requireNonNegativeInteger(
          raw.expectedRevision,
          `${type}.expectedRevision`
        )
      };
    case "deck.delete":
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        expectedRevision: requireNonNegativeInteger(
          raw.expectedRevision,
          `${type}.expectedRevision`
        )
      };
    case "deck.purge":
      return { type, deckId: requireIdentifier(raw.deckId, `${type}.deckId`) };
    case "prompt.create.request":
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        expectedRevision: requireNonNegativeInteger(
          raw.expectedRevision,
          `${type}.expectedRevision`
        ),
        target: decodePromptCreateTarget(raw.target, `${type}.target`),
        prompt: requireString(raw.prompt, `${type}.prompt`),
        // An empty scope is meaningful — Knowledge expands it to the whole
        // project — so an empty array is accepted and only a missing one is not.
        contextEntries: decodeContextEntries(raw.contextEntries, `${type}.contextEntries`),
        stabilisationText: requireText(raw.stabilisationText, `${type}.stabilisationText`)
      };
    case "prompt.update-definition":
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        site: decodePromptSite(raw.site, `${type}.site`),
        expectedDefinitionRevision: requireNonNegativeInteger(
          raw.expectedDefinitionRevision,
          `${type}.expectedDefinitionRevision`
        ),
        prompt: requireString(raw.prompt, `${type}.prompt`),
        contextEntries: decodeContextEntries(raw.contextEntries, `${type}.contextEntries`),
        stabilisationText: requireText(raw.stabilisationText, `${type}.stabilisationText`)
      };
    case "prompt.refresh.request":
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        site: decodePromptSite(raw.site, `${type}.site`),
        expectedRevision: requireNonNegativeInteger(
          raw.expectedRevision,
          `${type}.expectedRevision`
        )
      };
    case "formula.evaluate.request":
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        target: decodeRichContentTarget(raw.target, `${type}.target`),
        formulaAtomId: requireIdentifier(raw.formulaAtomId, `${type}.formulaAtomId`)
      };
  }
};

export const decodeSlideCommand = (value: unknown): SlideCommandRequest => {
  assertSlideWireInput(value, "Slides command request");
  const raw = requireRecord(value, "Slides command request");
  exactKeys(raw, ["origin", "actorId", "command"], "Slides command request");
  return {
    // Required. An absent origin is a client bug, and
    // defaulting it would mislabel history that Activity cannot later correct.
    origin: requireEnum(raw.origin, SLIDE_ORIGINS, "origin"),
    ...(raw.actorId !== undefined
      ? { actorId: requireIdentifier(raw.actorId, "actorId") }
      : {}),
    command: decodeCommand(raw.command)
  };
};
