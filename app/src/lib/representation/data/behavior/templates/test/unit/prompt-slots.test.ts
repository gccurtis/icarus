import { describe, expect, it } from "vitest";

import {
  defaultScopeOf,
  slotNamesIn,
  mergedPromptSlots,
  nextSlotName,
  offeredSlotName,
  promptSlotsOf,
  promptWordsIn,
  textSlotsOf,
  withPromptSlots,
  withPrompts
} from "$representation/data/behavior/templates/prompt-slots";
import type { TemplateBody, TemplateSlot } from "$representation/data/types/templates/template";

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

describe("a slot is made, never found", () => {
  it("gives no slot to a prompt nobody templated", () => {
    const held = body([prompt("a"), prompt("b", { scope: { include: [{ select: "project" }], exclude: [] } })]);
    expect(promptSlotsOf(held)).toEqual([]);
    expect(slotNamesIn(held)).toEqual([]);
  });

  it("gives one to each prompt somebody did", () => {
    const held = body([
      prompt("a", { slot: { name: "sources" } }),
      prompt("b", { slot: { name: "decisions", description: "Which threads" } })
    ]);
    const drafts = promptSlotsOf(held);
    expect(drafts.map((draft) => draft.slot.name)).toEqual(["sources", "decisions"]);
    expect(drafts[1].slot.description).toBe("Which threads");
  });

  it("offers the next name across everything the body already holds", () => {
    expect(offeredSlotName(0)).toBe("Slot 1");
    expect(nextSlotName(body([prompt("a")]))).toBe("Slot 1");
    const held = body([
      prompt("a", { slot: { name: "Slot 1" } }),
      {
        id: "t1",
        type: "text",
        variant: "paragraph",
        atoms: [{ id: "t1-a", kind: "template", name: "Slot 2" }],
        display: "{Slot 2}",
        marks: []
      }
    ]);
    expect([...slotNamesIn(held)].sort()).toEqual(["Slot 1", "Slot 2"]);
    expect(nextSlotName(held)).toBe("Slot 3");
  });
});

describe("a slot's default is whatever the thing already is", () => {
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
    prompt("a", { slot: { name: "sources" }, scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] } }),
    prompt("b", { scope: { include: [{ select: "project" }], exclude: [] } })
  ]);

  it("replaces a templated prompt's scope and leaves the rest alone", () => {
    const templated = withPromptSlots(held, promptSlotsOf(held)) as ReturnType<typeof body>;
    const blocks = templated.rows[0].blocks as { scope: unknown }[];
    expect(blocks[0].scope).toEqual({ include: [{ select: "slot", name: "sources" }], exclude: [] });
    expect(blocks[1].scope).toEqual({ include: [{ select: "project" }], exclude: [] });
  });

  it("keeps the set the prompt read as the slot's default", () => {
    expect(promptSlotsOf(held)[0].slot.default).toEqual({
      include: [{ select: "set", setId: "resourceSets:1" }],
      exclude: []
    });
  });

  it("writes each prompt onto the block that asks it, and reads it back by slot", () => {
    const asked = withPrompts(held, { a: "  What broke?  ", b: "Anything" });
    const templated = withPromptSlots(asked, promptSlotsOf(asked)) as unknown as TemplateBody;
    expect(promptWordsIn(templated)).toEqual({ sources: "What broke?" });
  });
});

describe("text slots", () => {
  it("carry the words they stand in for", () => {
    const held = body([
      {
        id: "t1",
        type: "text",
        variant: "paragraph",
        atoms: [
          { id: "a1", kind: "literal", text: "Dear " },
          { id: "a2", kind: "template", name: "Slot 1", description: "Who it is for", text: "Ana" }
        ],
        display: "Dear {Slot 1}",
        marks: []
      }
    ]);
    expect(textSlotsOf(held)).toEqual([
      { name: "Slot 1", label: "Slot 1", kind: "text", description: "Who it is for", text: "Ana" }
    ]);
  });
});

describe("saving a template again", () => {
  it("takes the name from the thing and leaves a description alone", () => {
    const known: TemplateSlot[] = [
      { name: "sources", label: "sources", kind: "scope", description: "Old words" }
    ];
    const fresh = promptSlotsOf(body([prompt("b", { slot: { name: "sources" } })])).map(
      (draft) => draft.slot
    );
    expect(mergedPromptSlots(known, fresh)[0].description).toBe("Old words");
  });

  it("keeps a slot nothing in the body asks for any more", () => {
    const known: TemplateSlot[] = [{ name: "subject", label: "Subject", kind: "text" }];
    const fresh = promptSlotsOf(body([prompt("a", { slot: { name: "sources" } })])).map(
      (draft) => draft.slot
    );
    expect(mergedPromptSlots(known, fresh).map((slot) => slot.name)).toEqual(["sources", "subject"]);
  });
});
