import { AnalyticWireError } from "../domain/errors.js";
import type { AnalyticCommand, AnalyticDefinition } from "../domain/model.js";
import {
  exactKeys,
  optionalString,
  passthroughDefinition,
  record,
  requiredRevision,
  requiredString
} from "./common.js";

const COMMAND_TYPES = [
  "analytic.create",
  "analytic.update",
  "analytic.delete",
  "analytic.purge",
  "analytic.save",
  "analytic.copy"
] as const;

export const decodeAnalyticCommand = (body: unknown): AnalyticCommand => {
  const envelope = record(body, "Structured Analytic command");
  exactKeys(envelope, ["type", "input"], "Structured Analytic command");

  const type = envelope.type;
  if (typeof type !== "string" || !(COMMAND_TYPES as readonly string[]).includes(type)) {
    throw new AnalyticWireError(
      `Structured Analytic command type must be one of: ${COMMAND_TYPES.join(", ")}`
    );
  }
  const input = record(envelope.input, `${type} input`);

  switch (type) {
    case "analytic.create": {
      exactKeys(input, ["title", "description", "definition"], type);
      const description = optionalString(input, "description", type);
      return {
        type,
        input: {
          title: requiredString(input, "title", type),
          ...(description !== undefined ? { description } : {}),
          definition: passthroughDefinition(input, type) as AnalyticDefinition
        }
      };
    }

    case "analytic.update": {
      exactKeys(input, ["id", "expectedRevision", "title", "description", "definition"], type);
      const description = optionalString(input, "description", type);
      return {
        type,
        input: {
          id: requiredString(input, "id", type),
          expectedRevision: requiredRevision(input, type),
          title: requiredString(input, "title", type),
          ...(description !== undefined ? { description } : {}),
          definition: passthroughDefinition(input, type) as AnalyticDefinition
        }
      };
    }

    case "analytic.delete": {
      exactKeys(input, ["id", "expectedRevision"], type);
      return {
        type,
        input: {
          id: requiredString(input, "id", type),
          expectedRevision: requiredRevision(input, type)
        }
      };
    }

    case "analytic.purge": {
      exactKeys(input, ["id"], type);
      return { type, input: { id: requiredString(input, "id", type) } };
    }

    // save and copy are the same wire shape and different semantics: one writes
    // the compiled formula and stays live, the other writes resolved rows and
    // freezes. Kept as separate cases rather than merged, so the two never
    // silently acquire different fields without the reader noticing.
    case "analytic.save": {
      exactKeys(input, ["id", "name", "description"], type);
      const description = optionalString(input, "description", type);
      return {
        type,
        input: {
          id: requiredString(input, "id", type),
          name: requiredString(input, "name", type),
          ...(description !== undefined ? { description } : {})
        }
      };
    }

    default: {
      exactKeys(input, ["id", "name", "description"], type);
      const description = optionalString(input, "description", type);
      return {
        type: "analytic.copy",
        input: {
          id: requiredString(input, "id", type),
          name: requiredString(input, "name", type),
          ...(description !== undefined ? { description } : {})
        }
      };
    }
  }
};
