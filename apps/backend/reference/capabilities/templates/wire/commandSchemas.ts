import { TemplateWireError } from "../domain/errors.js";
import type {
  TemplateCommand,
  TemplateCommandRequest,
  TemplateOrigin,
  TemplateResourceRef
} from "../domain/model.js";
import {
  decodeBindingArguments,
  decodeDeclaredBindings,
  exactKeys,
  optionalText,
  record,
  requireIdentifier,
  requireName,
  requireRevision,
  TEMPLATE_WIRE_LIMITS
} from "./valueSchemas.js";

const origins = new Set<TemplateOrigin>(["user", "agent", "automation", "system"]);

/**
 * Keyed by command type so the decoder and the union cannot drift. Note
 * `template.register` has no `templateId`: Templates allocates it. A client
 * that sends one gets a 400 from exactKeys rather than silent acceptance.
 */
const COMMAND_KEYS: Record<TemplateCommand["type"], readonly string[]> = {
  "template.register": ["type", "source", "name", "description", "contextBindings"],
  "template.update": [
    "type",
    "templateId",
    "expectedRevision",
    "name",
    "description",
    "contextBindings",
    "resourceOperations"
  ],
  "template.instantiate": [
    "type",
    "templateId",
    "destinationResourceId",
    "title",
    "contextBindings"
  ],
  "template.delete": ["type", "templateId"],
  "template.purge": ["type", "templateId"]
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
        name: requireName(command, "name", "Template name"),
        ...(description !== undefined ? { description } : {}),
        contextBindings: decodeDeclaredBindings(
          command.contextBindings,
          "Template contextBindings"
        )
      };
    }
    case "template.update": {
      const description = optionalText(
        command,
        "description",
        "Template description",
        TEMPLATE_WIRE_LIMITS.maxDescriptionBytes
      );
      return {
        type: "template.update",
        templateId: requireIdentifier(command, "templateId", "Template templateId"),
        expectedRevision: requireRevision(
          command,
          "expectedRevision",
          "Template expectedRevision"
        ),
        // Each field is optional and means "leave alone" when absent, so the
        // conditional spread is load-bearing rather than cosmetic: writing
        // `name: undefined` would also drop it from the command digest, but it
        // would stop the service telling "unchanged" from "cleared".
        ...(command.name !== undefined
          ? { name: requireName(command, "name", "Template name") }
          : {}),
        ...(description !== undefined ? { description } : {}),
        ...(command.contextBindings !== undefined
          ? {
              contextBindings: decodeDeclaredBindings(
                command.contextBindings,
                "Template contextBindings"
              )
            }
          : {}),
        ...(command.resourceOperations !== undefined
          ? { resourceOperations: command.resourceOperations }
          : {})
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
        contextBindings: decodeBindingArguments(
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
    case "template.purge":
      return {
        type: "template.purge",
        templateId: requireIdentifier(command, "templateId", "Template templateId")
      };
  }
};

export const decodeTemplateCommand = (value: unknown): TemplateCommandRequest => {
  const body = record(value, "Template command request");
  exactKeys(body, ["requestId", "origin", "command"], "Template command request");
  const origin = requireIdentifier(body, "origin", "Template origin") as TemplateOrigin;
  if (!origins.has(origin)) {
    throw new TemplateWireError(`Template origin '${origin}' is not recognised`);
  }
  return {
    requestId: requireIdentifier(body, "requestId", "Template requestId"),
    origin,
    command: decodeCommand(body.command)
  };
};
