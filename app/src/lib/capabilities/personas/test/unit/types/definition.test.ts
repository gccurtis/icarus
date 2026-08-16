import { describe, expect, it } from "vitest";
import { personasRefusal } from "$personas/errors";
import {
  personaDefinition,
  personaDefinitionValidator,
  type PersonaDefinition
} from "$personas/types/definition";

const blank: PersonaDefinition = {
  focus: "",
  background: "",
  approach: "",
  outputPreferences: "",
  verification: ""
};

const refusalFrom = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error: unknown) {
    return personasRefusal(error);
  }
};

describe("personaDefinitionValidator", () => {
  it("has exactly the five sections, each answering one question", () => {
    // Not four, not six, and not one instructions box: focus is what this is
    // about, background what is already known, approach how to work,
    // outputPreferences what comes out, verification when it is done.
    expect(Object.keys(personaDefinitionValidator.fields).sort()).toEqual([
      "approach",
      "background",
      "focus",
      "outputPreferences",
      "verification"
    ]);
  });

  it("stores every section as plain text", () => {
    // Each goes to a model as part of a system prompt, so text is the
    // destination format. Blocks would mean serializing back to text on every
    // use, and the serialization would be what determined behaviour.
    for (const field of Object.values(personaDefinitionValidator.fields)) {
      expect(field.kind).toBe("string");
    }
  });
});

describe("personaDefinition", () => {
  it("trims every section, because trailing space is not a section", () => {
    const definition = personaDefinition({ ...blank, focus: "  Margin analysis  " });

    expect(definition.focus).toBe("Margin analysis");
  });

  it("keeps an empty section rather than dropping it", () => {
    // All five are required strings; what an empty one changes is the render,
    // where the heading goes with it.
    expect(personaDefinition({ ...blank, focus: "Margin" })).toEqual({
      ...blank,
      focus: "Margin"
    });
  });

  it("accepts five empty sections when a scope says what to work against", () => {
    // A pure scope persona is a real persona: "work against this material" with
    // no behavioural text.
    expect(personaDefinition(blank, { op: "project" })).toEqual(blank);
  });

  it("refuses five empty sections with nothing to work against", () => {
    expect(refusalFrom(() => personaDefinition(blank))).toMatchObject({
      code: "empty-definition"
    });
    expect(refusalFrom(() => personaDefinition({ ...blank, approach: "   " }))).toMatchObject({
      code: "empty-definition"
    });
  });
});
