import { describe, expect, it } from "vitest";
import { personaSystemMessages, renderPersonaPrompt } from "$personas/types/prompt";
import type { PersonaDefinition } from "$personas/types/definition";

const blank: PersonaDefinition = {
  focus: "",
  background: "",
  approach: "",
  outputPreferences: "",
  verification: ""
};

describe("renderPersonaPrompt", () => {
  it("writes each section under a heading, in the order the form asks", () => {
    const prompt = renderPersonaPrompt({
      focus: "Margin, not revenue",
      background: "We sell components",
      approach: "Cite every number",
      outputPreferences: "A short note",
      verification: "Check the totals"
    });

    expect(prompt.split("\n").filter((line) => line.startsWith("#"))).toEqual([
      "## Focus",
      "## Background",
      "## Approach",
      "## Output preferences",
      "## Verification"
    ]);
    expect(prompt).toContain("Cite every number");
  });

  it("omits an empty section entirely, heading included", () => {
    const prompt = renderPersonaPrompt({ ...blank, approach: "Cite every number" });

    expect(prompt).toBe("## Approach\n\nCite every number");
  });

  it("renders a pure scope persona to an empty string", () => {
    // Scope is retrievable material and is never rendered, so a persona whose
    // whole statement is "work against this" has nothing to say in the prompt.
    expect(renderPersonaPrompt(blank)).toBe("");
  });
});

describe("personaSystemMessages", () => {
  it("contributes one message when the persona has behavioural text", () => {
    expect(personaSystemMessages({ ...blank, focus: "Margin" })).toEqual(["## Focus\n\nMargin"]);
  });

  it("contributes none when the prompt renders empty", () => {
    // The consumer omits the message rather than sending a blank system turn,
    // and it does so by having none to send rather than by remembering to check.
    expect(personaSystemMessages(blank)).toEqual([]);
  });
});
