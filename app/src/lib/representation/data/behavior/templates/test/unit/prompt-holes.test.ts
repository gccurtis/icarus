import { describe, expect, it } from "vitest";

import {
  defaultScopeOf,
  holeNamesIn,
  mergedPromptHoles,
  nextHoleName,
  offeredHoleName,
  promptHolesOf,
  promptWordsIn,
  textHolesOf,
  withPromptHoles,
  withPrompts
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

describe("a hole is made, never found", () => {
  it("gives no hole to a prompt nobody templated", () => {
    const held = body([prompt("a"), prompt("b", { scope: { include: [{ select: "project" }], exclude: [] } })]);
    expect(promptHolesOf(held)).toEqual([]);
    expect(holeNamesIn(held)).toEqual([]);
  });

  it("gives one to each prompt somebody did", () => {
    const held = body([
      prompt("a", { hole: { name: "sources" } }),
      prompt("b", { hole: { name: "decisions", description: "Which threads" } })
    ]);
    const drafts = promptHolesOf(held);
    expect(drafts.map((draft) => draft.hole.name)).toEqual(["sources", "decisions"]);
    expect(drafts[1].hole.description).toBe("Which threads");
  });

  it("offers the next name across everything the body already holds", () => {
    expect(offeredHoleName(0)).toBe("Hole 1");
    expect(nextHoleName(body([prompt("a")]))).toBe("Hole 1");
    const held = body([
      prompt("a", { hole: { name: "Hole 1" } }),
      {
        id: "t1",
        type: "text",
        variant: "paragraph",
        atoms: [{ id: "t1-a", kind: "template", name: "Hole 2" }],
        display: "{Hole 2}",
        marks: []
      }
    ]);
    expect([...holeNamesIn(held)].sort()).toEqual(["Hole 1", "Hole 2"]);
    expect(nextHoleName(held)).toBe("Hole 3");
  });
});

describe("a hole's default is whatever the thing already is", () => {
  it("is the scope the prompt reads, whatever that scope is", () => {
    for (const scope of [
      { include: [{ select: "project" }], exclude: [] },
      { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] },
      { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] },
      { include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["finding"] }] }
    ]) {
      expect(defaultScopeOf(scope)).toEqual(scope);
    }
  });

  it("is the whole project for a prompt that was never scoped", () => {
    const whole = { include: [{ select: "project" }], exclude: [] };
    expect(defaultScopeOf(undefined)).toEqual(whole);
    expect(defaultScopeOf({ include: [], exclude: [] })).toEqual(whole);
  });
});

describe("a body as a template holds it", () => {
  const held = body([
    prompt("a", { hole: { name: "sources" }, scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] } }),
    prompt("b", { scope: { include: [{ select: "project" }], exclude: [] } })
  ]);

  it("replaces a templated prompt's scope and leaves the rest alone", () => {
    const templated = withPromptHoles(held, promptHolesOf(held)) as ReturnType<typeof body>;
    const blocks = templated.rows[0].blocks as { scope: unknown }[];
    expect(blocks[0].scope).toEqual({ include: [{ select: "hole", name: "sources" }], exclude: [] });
    expect(blocks[1].scope).toEqual({ include: [{ select: "project" }], exclude: [] });
  });

  it("keeps the set the prompt read as the hole's default", () => {
    expect(promptHolesOf(held)[0].hole.default).toEqual({
      include: [{ select: "set", setId: "resourceSets:1" }],
      exclude: []
    });
  });

  it("writes each prompt onto the block that asks it, and reads it back by hole", () => {
    const asked = withPrompts(held, { a: "  What broke?  ", b: "Anything" });
    const templated = withPromptHoles(asked, promptHolesOf(asked)) as unknown as TemplateBody;
    expect(promptWordsIn(templated)).toEqual({ sources: "What broke?" });
  });
});

describe("text holes", () => {
  it("carry the words they stand in for", () => {
    const held = body([
      {
        id: "t1",
        type: "text",
        variant: "paragraph",
        atoms: [
          { id: "a1", kind: "literal", text: "Dear " },
          { id: "a2", kind: "template", name: "Hole 1", description: "Who it is for", text: "Ana" }
        ],
        display: "Dear {Hole 1}",
        marks: []
      }
    ]);
    expect(textHolesOf(held)).toEqual([
      { name: "Hole 1", label: "Hole 1", kind: "text", description: "Who it is for", text: "Ana" }
    ]);
  });
});

describe("saving a template again", () => {
  it("takes the name from the thing and leaves a description alone", () => {
    const known: TemplateHole[] = [
      { name: "sources", label: "sources", description: "Old words" }
    ];
    const fresh = promptHolesOf(body([prompt("b", { hole: { name: "sources" } })])).map(
      (draft) => draft.hole
    );
    expect(mergedPromptHoles(known, fresh)[0].description).toBe("Old words");
  });

  it("keeps a hole nothing in the body asks for any more", () => {
    const known: TemplateHole[] = [{ name: "subject", label: "Subject", kind: "text" }];
    const fresh = promptHolesOf(body([prompt("a", { hole: { name: "sources" } })])).map(
      (draft) => draft.hole
    );
    expect(mergedPromptHoles(known, fresh).map((hole) => hole.name)).toEqual(["sources", "subject"]);
  });
});
