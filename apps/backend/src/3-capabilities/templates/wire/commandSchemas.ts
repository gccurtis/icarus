import { TemplateWireError } from "../domain/errors.js";
import type {
  TemplateCommand,
  TemplateCommandRequest,
  TemplateResourceRef
} from "../domain/model.js";
import {
  decodeContextBindings,
  exactKeys,
  optionalText,
  record,
  requireIdentifier,
  TEMPLATE_WIRE_LIMITS
} from "./valueSchemas.js";

/**
 * Keyed by command type so the decoder and the union cannot drift. Note
 * `template.register` has no `templateId`: Templates allocates it. A client
 * that sends one gets a 400 from exactKeys rather than silent acceptance.
 */
const COMMAND_KEYS: Record<TemplateCommand["type"], readonly string[]> = {
  "template.register": ["type", "source", "description", "contextBindings"],
  "template.instantiate": [
    "type",
    "templateId",
    "destinationResourceId",
    "title",
    "contextBindings"
  ],
  "template.delete": ["type", "templateId"]
};

const decodeResourceRef = (value: unknown, label: string): TemplateResourceRef => {
  const ref = record(value, label);
  exactKeys(ref, ["kind", "resourceId"], label);
  return {
    kind: requireIdentifier(ref, "kind", `${label} kind`),
    resourceId: requireIdentifier(ref, "resourceId", `${label} resourceId`)
  };
};

const decodeCommand = (value: unknown): TemplateCommand => {
  const command = record(value, "Template command");
  const type = command.type;
  if (typeof type !== "string" || !(type in COMMAND_KEYS)) {
    throw new TemplateWireError("Template command type is not recognised");
  }
  const commandType = type as TemplateCommand["type"];
  exactKeys(command, COMMAND_KEYS[commandType], `Template command '${commandType}'`);

  switch (commandType) {
    case "template.register": {
      const description = optionalText(
        command,
        "description",
        "Template description",
        TEMPLATE_WIRE_LIMITS.maxDescriptionBytes
      );
      return {
        type: "template.register",
        source: decodeResourceRef(command.source, "Template source"),
        ...(description !== undefined ? { description } : {}),
        contextBindings: decodeContextBindings(
          command.contextBindings,
          "Template contextBindings"
        )
      };
    }
    case "template.instantiate": {
      const title = optionalText(
        command,
        "title",
        "Template title",
        TEMPLATE_WIRE_LIMITS.maxTitleBytes
      );
      return {
        type: "template.instantiate",
        templateId: requireIdentifier(command, "templateId", "Template templateId"),
        destinationResourceId: requireIdentifier(
          command,
          "destinationResourceId",
          "Template destinationResourceId"
        ),
        ...(title !== undefined ? { title } : {}),
        contextBindings: decodeContextBindings(
          command.contextBindings,
          "Template contextBindings"
        )
      };
    }
    case "template.delete":
      return {
        type: "template.delete",
        templateId: requireIdentifier(command, "templateId", "Template templateId")
      };
  }
};

export const decodeTemplateCommand = (value: unknown): TemplateCommandRequest => {
  const body = record(value, "Template command request");
  exactKeys(body, ["requestId", "command"], "Template command request");
  return {
    requestId: requireIdentifier(body, "requestId", "Template requestId"),
    command: decodeCommand(body.command)
  };
};
