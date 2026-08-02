import { PersonaWireError } from "../domain/errors.js";
import type { PersonaDefinition, PersonaQuery } from "../domain/model.js";
import { definitionField, exactKeys, record, sectionsField, stringField } from "./common.js";

export const decodePersonaQuery = (value: unknown): PersonaQuery => {
  const query = record(value, "Persona query");
  const type = stringField(query, "type", "Persona query type");

  switch (type) {
    case "persona.get":
      exactKeys(query, ["type", "id"], "Persona get query");
      return { type, id: stringField(query, "id", "Persona ID") };

    case "persona.getByName":
      exactKeys(query, ["type", "displayName"], "Persona getByName query");
      return { type, displayName: stringField(query, "displayName", "Persona displayName") };

    case "persona.list":
      exactKeys(query, ["type"], "Persona list query");
      return { type };

    case "persona.render": {
      exactKeys(query, ["type", "definition", "sections"], "Persona render query");
      const sections = sectionsField(query, "sections", "Persona sections");
      return {
        type,
        definition: definitionField(
          query.definition,
          "Persona definition"
        ) as unknown as PersonaDefinition,
        ...(sections === undefined ? {} : { sections })
      };
    }

    default:
      throw new PersonaWireError(`Unsupported Persona query '${type}'`);
  }
};
