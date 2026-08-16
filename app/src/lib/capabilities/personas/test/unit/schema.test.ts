import { describe, expect, it } from "vitest";
import { personasTables } from "$personas/schema";

describe("personas schema", () => {
  it("leads every index with projectId", () => {
    const indexes = personasTables.personas[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("holds what the model states and nothing else", () => {
    const fields = Object.keys(personasTables.personas.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "name",
        "description",
        "definition",
        "scope",
        "modelBinding",
        "tools",
        "avatar",
        "createdBy",
        "revision",
        "updatedAt"
      ].sort()
    );
  });

  /**
   * Absent means available to every project — the same reading `templates` takes,
   * and still the first column of the index, so the globals are their own key
   * range rather than rows a project read might stray into.
   */
  it("makes projectId optional, because a persona can belong to every project", () => {
    expect(personasTables.personas.validator.fields.projectId.isOptional).toBe("optional");
  });

  it("carries tools as a flat list of names", () => {
    // Not grants with scopes, conditions, and expiry: the enforcement point is
    // the tool implementation regardless, and absence from the list is the whole
    // restriction.
    const tools = personasTables.personas.validator.fields.tools;

    expect(tools.kind).toBe("array");
    expect(tools.element.kind).toBe("string");
  });

  it("names a model binding rather than a model", () => {
    // Model identifiers change on someone else's schedule; a binding does not.
    const binding = personasTables.personas.validator.fields.modelBinding;

    expect(binding.isOptional).toBe("optional");
    expect(binding.kind).toBe("string");
  });
});
