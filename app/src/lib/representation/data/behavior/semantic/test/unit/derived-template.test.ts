import { describe, expect, it } from "vitest";
import {
  derivedTemplateDefinition,
  renderDerivedTemplate
} from "$representation/data/behavior/semantic/derived-template";

describe("templated Derived Outputs", () => {
  it("validates named variables and renders only application-resolved values", () => {
    const template = derivedTemplateDefinition({
      variables: [
        { name: "person", prompt: "Find the person's name" },
        { name: "age", prompt: "Find the person's age" }
      ],
      output: "{{person}} is {{ age }} years old.",
      exampleResponse: "Jordan is 42 years old."
    });

    expect(
      renderDerivedTemplate(template, [
        { name: "person", value: "Avery", evidence: [] },
        { name: "age", value: "37", evidence: [] }
      ])
    ).toBe("Avery is 37 years old.");
  });

  it("rejects unknown, unused, malformed, and duplicate variables", () => {
    expect(() =>
      derivedTemplateDefinition({
        variables: [{ name: "age", prompt: "Find age" }],
        output: "{{missing}}"
      })
    ).toThrow(/unknown variable/);
    expect(() =>
      derivedTemplateDefinition({
        variables: [{ name: "age", prompt: "Find age" }],
        output: "No placeholder"
      })
    ).toThrow(/does not use/);
    expect(() =>
      derivedTemplateDefinition({
        variables: [{ name: "age", prompt: "Find age" }],
        output: "{{age"
      })
    ).toThrow(/malformed/);
    expect(() =>
      derivedTemplateDefinition({
        variables: [
          { name: "age", prompt: "Find age" },
          { name: "age", prompt: "Find age again" }
        ],
        output: "{{age}}"
      })
    ).toThrow(/unique/);
  });
});
