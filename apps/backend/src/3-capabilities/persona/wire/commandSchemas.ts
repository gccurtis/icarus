import { PersonaWireError } from "../domain/errors.js";
import type { PersonaCommand, PersonaDefinition } from "../domain/model.js";
import {
  definitionField,
  exactKeys,
  optionalStringField,
  record,
  revisionField,
  stringField
} from "./common.js";

export const decodePersonaCommand = (value: unknown): PersonaCommand => {
  const command = record(value, "Persona command");
  const type = stringField(command, "type", "Persona command type");

  switch (type) {
    case "persona.create": {
      exactKeys(command, ["type", "displayName", "description", "definition"], "Persona create command");
      return {
        type,
        input: {
          displayName: stringField(command, "displayName", "Persona displayName"),
          ...(command.description === undefined
            ? {}
            : { description: optionalStringField(command, "description", "Persona description") as string }),
          definition: definitionField(command.definition, "Persona definition") as unknown as PersonaDefinition
        }
      };
    }
    case "persona.update": {
      exactKeys(
        command,
        ["type", "id", "expectedRevision", "displayName", "description", "definition"],
        "Persona update command"
      );
      return {
        type,
        input: {
          id: stringField(command, "id", "Persona ID"),
          expectedRevision: revisionField(command, "expectedRevision", "Persona expectedRevision"),
          ...(command.displayName === undefined
            ? {}
            : { displayName: stringField(command, "displayName", "Persona displayName") }),
          ...(command.description === undefined
            ? {}
            : { description: stringField(command, "description", "Persona description") }),
          ...(command.definition === undefined
            ? {}
            : {
                definition: definitionField(
                  command.definition,
                  "Persona definition"
                ) as unknown as PersonaDefinition
              })
        }
      };
    }
    case "persona.delete": {
      exactKeys(command, ["type", "id", "expectedRevision"], "Persona delete command");
      return {
        type,
        input: {
          id: stringField(command, "id", "Persona ID"),
          expectedRevision: revisionField(command, "expectedRevision", "Persona expectedRevision")
        }
      };
    }
    case "persona.purge": {
      exactKeys(command, ["type", "id"], "Persona purge command");
      return {
        type,
        input: { id: stringField(command, "id", "Persona ID") }
      };
    }
    default:
      throw new PersonaWireError(`Unsupported Persona command '${type}'`);
  }
};
