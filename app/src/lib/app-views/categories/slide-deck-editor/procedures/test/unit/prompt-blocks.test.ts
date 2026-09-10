import { describe, expect, it } from "vitest";

import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import {
  linkPromptBlockOps,
  promptBlocksIn,
  promptScopeOps,
  syncPromptBlockOps,
  withPromptElement
} from "$app-views/categories/slide-deck-editor/procedures/prompt-blocks";
import { sceneOf } from "$app-views/categories/slide-deck-editor/procedures/scene";
import { replaced } from "$app-views/categories/slide-deck-editor/procedures/typing";

const body = (): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "#111", accent: "#73f" } },
  styles: {
    defaultKey: "body",
    styles: { body: { name: "Body", fontSize: 24 } }
  },
  layouts: [],
  sections: [],
  slides: [{
    id: "slide-one",
    notes: [],
    elements: [{
      id: "element-one",
      frame: { x: 0.12, y: 0.18, width: 0.44, height: 0.12 },
      overflow: "grow",
      paint: { fill: "#fff", opacity: 0.9 },
      content: {
        type: "text",
        block: {
          id: "block-one",
          type: "text",
          variant: "paragraph",
          style: "body",
          atoms: [{ id: "atom-one", kind: "literal", text: "Editable answer" }],
          display: "Editable answer",
          marks: [{
            id: "mark-one",
            from: { atom: "atom-one", offset: 0 },
            to: { atom: "atom-one", offset: 8 },
            style: ["bold"]
          }],
          format: { horizontalAlignment: "center" }
        }
      }
    }]
  }]
});

const output = (display: string): DerivedOutput => ({
  _id: "derivedOutputs:slide" as Id<"derivedOutputs">,
  _creationTime: 1,
  projectId: "projects:one" as Id<"projects">,
  prompt: "Give me the answer",
  definitionRevision: 1,
  origin: { kind: "slides", id: "deck-one" },
  queries: [],
  evidence: [],
  lastResponse: {
    id: "generated",
    type: "text",
    variant: "paragraph",
    atoms: [{ id: "generated-atom", kind: "literal", text: display }],
    display,
    marks: []
  },
  state: "fresh",
  refreshedAt: 20,
  createdBy: { kind: "system" },
  updatedAt: 20
});

describe("slide Prompt Blocks", () => {
  /**
   * Linking hands the scope over, rather than copying it.
   *
   * Two places holding a scope is two places that can disagree, and only one of
   * them is what the agent obeys. So the block keeps one until there is an
   * output to keep it, and gives it up at the moment there is.
   */
  it("takes the Derived Output identity and gives up the scope", () => {
    const before = withPromptElement(body(), "element-one").body;
    const held = before.slides[0].elements[0].content;
    if (held.type !== "prompt") throw new Error("expected a prompt element");
    const scoped = applyOps(
      before,
      promptScopeOps(held.block, { include: [{ select: "project" }], exclude: [] })
    );
    const block = scoped.slides[0].elements[0].content;
    if (block.type !== "prompt") throw new Error("expected a prompt element");
    expect(block.block.scope).toEqual({ include: [{ select: "project" }], exclude: [] });

    const linked = applyOps(
      scoped,
      linkPromptBlockOps(block.block, "derivedOutputs:slide" as Id<"derivedOutputs">)
    );
    const after = linked.slides[0].elements[0].content;
    if (after.type !== "prompt") throw new Error("expected a prompt element");
    expect(after.block.derivedOutputId).toBe("derivedOutputs:slide");
    expect("scope" in after.block).toBe(false);
  });

  it("converts only the inner text contract and preserves the element presentation", () => {
    const before = body();
    const beforeScene = sceneOf(before, before.slides[0], { width: 1280, height: 720 });
    const changed = withPromptElement(before, "element-one");
    const element = changed.body.slides[0].elements[0];
    const afterScene = sceneOf(changed.body, changed.body.slides[0], {
      width: 1280,
      height: 720
    });

    expect(changed.ops).toHaveLength(1);
    expect(element).toMatchObject({
      id: "element-one",
      frame: before.slides[0].elements[0].frame,
      overflow: "grow",
      paint: before.slides[0].elements[0].paint,
      content: {
        type: "prompt",
        block: {
          id: "block-one",
          type: "prompt",
          style: "body",
          display: "Editable answer",
          marks: before.slides[0].elements[0].content.type === "text"
            ? before.slides[0].elements[0].content.block.marks
            : [],
          format: { horizontalAlignment: "center" },
          state: "idle"
        }
      }
    });
    expect(promptBlocksIn(changed.body)).toMatchObject([{
      slideId: "slide-one",
      slideIndex: 0,
      elementId: "element-one",
      block: { id: "block-one" }
    }]);
    expect(afterScene.items[0]).toMatchObject({
      frame: beforeScene.items[0].frame,
      fill: beforeScene.items[0].fill,
      opacity: beforeScene.items[0].opacity,
      text: {
        display: beforeScene.items[0].text?.display,
        size: beforeScene.items[0].text?.size,
        align: beforeScene.items[0].text?.align
      }
    });
  });

  it("publishes generated text through slide ops while keeping mark ranges", () => {
    const converted = withPromptElement(body(), "element-one").body;
    const entry = promptBlocksIn(converted)[0];
    const changed = applyOps(converted, syncPromptBlockOps(entry.block, output("A much longer answer")));
    const prompt = promptBlocksIn(changed)[0].block;

    expect(prompt.display).toBe("A much longer answer");
    expect(prompt.atoms).toEqual([
      { id: "atom-one", kind: "literal", text: "A much longer answer" }
    ]);
    expect(prompt.marks[0]).toMatchObject({
      from: { atom: "atom-one", offset: 0 },
      to: { atom: "atom-one", offset: 8 },
      style: ["bold"]
    });
    expect(prompt.state).toBe("fresh");
  });

  it("edits a Prompt Block with the same atom operation used by authored text", () => {
    const converted = withPromptElement(body(), "element-one").body;
    const prompt = promptBlocksIn(converted)[0].block;
    const changed = applyOps(converted, replaced(prompt, 9, 15, "result"));

    expect(promptBlocksIn(changed)[0].block.display).toBe("Editable result");
  });
});
