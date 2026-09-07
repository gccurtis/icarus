import { describe, expect, it } from "vitest";

import { sceneOf, textSceneOf } from "$app-views/categories/slide-deck-editor/procedures/scene";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

const block: TextBlock = {
  id: "text-1",
  type: "text",
  variant: "paragraph",
  style: "body",
  atoms: [{ id: "atom-1", kind: "literal", text: "Styled text" }],
  display: "Styled text",
  marks: []
};

const body: SlideDeckBody = {
  aspectRatio: "16:9",
  theme: {
    background: { kind: "color", color: "--token-surface-elevated" },
    colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" }
  },
  styles: {
    defaultKey: "body",
    styles: {
      body: {
        name: "Body",
        underline: true,
        strikethrough: true,
        color: "--token-ink-secondary",
        background: "--token-color-attention-surface"
      }
    }
  },
  layouts: [],
  sections: [],
  slides: [
    {
      id: "slide-1",
      notes: [],
      elements: [
        {
          id: "element-1",
          frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
          content: { type: "text", block }
        }
      ]
    }
  ]
};

describe("deck text scene", () => {
  it("carries named-style strike and background through valid CSS tokens", () => {
    const text = textSceneOf(block, body.styles.styles.body, body.theme);
    expect(text).toMatchObject({
      underline: true,
      strike: true,
      color: "var(--token-ink-secondary)",
      background: "var(--token-color-attention-surface)"
    });
  });

  it("resolves tokenized slide backgrounds at the presentation boundary", () => {
    const scene = sceneOf(body, body.slides[0], { width: 1280, height: 720 });
    expect(scene.background).toBe("var(--token-surface-elevated)");
    expect(scene.items[0].text?.strike).toBe(true);
    expect(scene.items[0].text?.background).toBe("var(--token-color-attention-surface)");
  });
});
