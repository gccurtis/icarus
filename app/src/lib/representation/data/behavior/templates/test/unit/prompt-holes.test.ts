import { describe, expect, it } from "vitest";

import {
  defaultScopeOf,
  holeNameIn,
  offeredHoleName,
  offeredNameIn,
  promptHolesOf,
  promptWordsIn,
  withAsks,
  withPromptHoles,
  mergedPromptHoles
} from "$representation/data/behavior/templates/prompt-holes";
import type { TemplateBody, TemplateHole } from "$representation/data/types/templates/template";

const prompt = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "prompt",
  atoms: [{ id: `${id}-a`, kind: "literal", text: "Sum up" }],
  display: "Sum up",
  marks: [],
  state: "idle",
  ...extra
});

const body = (blocks: readonly unknown[]) => ({
  resource: "document",
  rows: [{ id: "r1", kind: "blocks", blocks }]
});

describe("what a prompt is called", () => {
  it("is offered by where it sits until somebody names it", () => {
    expect(offeredHoleName(0)).toBe("Prompt 1");
    expect(offeredHoleName(2)).toBe("Prompt 3");
    const held = body([prompt("a"), prompt("b")]);
    expect(offeredNameIn(held, "b")).toBe("Prompt 2");
    expect(holeNameIn(held, "b")).toBe("Prompt 2");
  });

  it("is what was typed once anything was", () => {
    const held = body([prompt("a"), prompt("b", { hole: { name: "evidence" } })]);
    expect(holeNameIn(held, "b")).toBe("evidence");
  });

  it("keeps the name a standing hole term already carries", () => {
    const held = body([
      prompt("a", { scope: { include: [{ select: "hole", name: "source_material" }], exclude: [] } })
    ]);
    expect(promptHolesOf(held)[0].hole.name).toBe("source_material");
  });
});

describe("what a hole selects when nobody says otherwise", () => {
  it("keeps a scope anybody could have meant", () => {
    expect(defaultScopeOf({ include: [{ select: "project" }], exclude: [] })).toEqual({
      include: [{ select: "project" }],
      exclude: []
    });
    expect(defaultScopeOf({ include: [{ select: "kinds", kinds: ["document"] }], exclude: [] })).toEqual({
      include: [{ select: "kinds", kinds: ["document"] }],
      exclude: []
    });
  });

  it("keeps nothing that was true only of the project it was written in", () => {
    expect(defaultScopeOf({ include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] })).toBeUndefined();
    expect(
      defaultScopeOf({ include: [{ select: "resources", refs: [] }], exclude: [] })
    ).toBeUndefined();
    expect(
      defaultScopeOf({ include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["finding"] }] })
    ).toBeUndefined();
  });

  it("counts a prompt that was never scoped as the whole project", () => {
    const whole = { include: [{ select: "project" }], exclude: [] };
    expect(defaultScopeOf(undefined)).toEqual(whole);
    expect(defaultScopeOf({ include: [], exclude: [] })).toEqual(whole);
  });
});

describe("a body as a template holds it", () => {
  const held = body([
    prompt("a", { scope: { include: [{ select: "project" }], exclude: [] } }),
    prompt("b", { hole: { name: "evidence", description: "What happened" }, scope: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } })
  ]);

  it("gives every prompt one hole, in the order they are written", () => {
    const drafts = promptHolesOf(held);
    expect(drafts.map((draft) => draft.hole.name)).toEqual(["Prompt 1", "evidence"]);
    expect(drafts[0].hole.default).toEqual({ include: [{ select: "project" }], exclude: [] });
    expect(drafts[1].hole.description).toBe("What happened");
  });

  it("replaces each prompt's scope with the hole that stands for it", () => {
    const templated = withPromptHoles(held, promptHolesOf(held)) as ReturnType<typeof body>;
    const blocks = templated.rows[0].blocks as { scope: unknown }[];
    expect(blocks[0].scope).toEqual({ include: [{ select: "hole", name: "Prompt 1" }], exclude: [] });
    expect(blocks[1].scope).toEqual({ include: [{ select: "hole", name: "evidence" }], exclude: [] });
  });

  it("writes each prompt's question onto the prompt, and reads it back by hole", () => {
    const asked = withAsks(held, { a: "  What broke?  ", b: "" });
    const templated = withPromptHoles(asked, promptHolesOf(asked)) as unknown as TemplateBody;
    expect(promptWordsIn(templated)).toEqual({ "Prompt 1": "What broke?" });
  });
});

describe("saving a template again", () => {
  it("takes the name and the words from the prompt, and leaves a settled default alone", () => {
    const known: TemplateHole[] = [
      {
        name: "evidence",
        label: "evidence",
        description: "Old words",
        default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
      }
    ];
    const drafts = promptHolesOf(
      body([prompt("b", { hole: { name: "evidence", description: "New words" }, scope: { include: [{ select: "project" }], exclude: [] } })])
    );
    expect(mergedPromptHoles(known, drafts)).toEqual([
      {
        name: "evidence",
        label: "evidence",
        description: "New words",
        default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
      }
    ]);
  });

  it("keeps a hole nothing in the body asks for any more", () => {
    const known: TemplateHole[] = [{ name: "subject", label: "Subject", kind: "text" }];
    const drafts = promptHolesOf(body([prompt("a")]));
    expect(mergedPromptHoles(known, drafts).map((hole) => hole.name)).toEqual(["Prompt 1", "subject"]);
  });
});
