import { describe, expect, it } from "vitest";

import type { SlideDeckBody, SlideElement } from "$representation/data/types/slide-decks/body";
import {
  labelOf,
  placedOn,
  stepped,
  valueAt,
  withDuplicatedSlide,
  withElementFrame,
  withGrouped,
  withMovedSlide,
  withNewSlide,
  withRestacked,
  withRestackedSet,
  withSavedLayout,
  withSet,
  withUngrouped,
  withoutElements,
  withoutSlide
} from "$app-views/categories/slide-deck-editor/procedures/deck";

const frame = (x: number, y = 0.1, width = 0.2, height = 0.2) => ({ x, y, width, height });

const text = (id: string, display: string) => ({
  id,
  type: "text" as const,
  variant: "paragraph" as const,
  atoms: [{ id: `${id}-a`, kind: "literal" as const, text: display }],
  display,
  marks: [
    { id: `${id}-m`, from: { atom: `${id}-a`, offset: 0 }, to: { atom: `${id}-a`, offset: 3 } }
  ]
});

const shape = (id: string, x: number): SlideElement => ({
  id,
  frame: frame(x),
  content: { type: "shape", shape: "rectangle" }
});

const deck = (over: Partial<SlideDeckBody> = {}): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body", fontSize: 20 }, title: { name: "Title", fontSize: 44 } } },
  layouts: [
    {
      id: "layout-title-only",
      key: "title-only",
      name: "Title only",
      locked: [],
      placeholders: [{ role: "title", frame: frame(0.1, 0.1, 0.8, 0.2), styleKey: "title" }]
    }
  ],
  sections: [{ id: "sec-1", name: "Opening", firstSlideId: "s1" }],
  slides: [
    {
      id: "s1",
      layoutKey: "title-only",
      notes: [],
      elements: [
        { id: "e1", frame: frame(0.1), content: { type: "text", block: text("b1", "One") } },
        shape("e2", 0.4),
        shape("e3", 0.7)
      ]
    },
    { id: "s2", notes: [], elements: [] },
    { id: "s3", notes: [], elements: [] }
  ],
  ...over
});

const ids = (body: SlideDeckBody) => body.slides.map((slide) => slide.id);

describe("slides", () => {
  it("a new slide takes the layout of the one it follows", () => {
    const next = withNewSlide(deck(), "s1");
    expect(next.body.slides[1].layoutKey).toBe("title-only");
    expect(next.body.slides[1].elements).toEqual([]);
  });

  it("a new slide from a named layout gets its placeholders as text boxes", () => {
    const next = withNewSlide(deck(), "s3", "title-only");
    const made = next.body.slides[3];
    expect(made.elements).toHaveLength(1);
    expect(made.elements[0].fromPlaceholder).toBe("title");
    expect(made.elements[0].content.type).toBe("text");
  });

  it("a duplicate shares no id with its original", () => {
    const next = withDuplicatedSlide(deck(), "s1");
    const copy = next.body.slides[1];
    const original = next.body.slides[0];
    expect(copy.id).not.toBe(original.id);
    expect(copy.elements[0].id).not.toBe(original.elements[0].id);
    const held = copy.elements[0].content;
    if (held.type !== "text") throw new Error("not text");
    expect(held.block.id).not.toBe("b1");
    expect(held.block.atoms[0].id).not.toBe("b1-a");
    expect(held.block.display).toBe("One");
  });

  it("removing the first slide re-anchors its section", () => {
    const next = withoutSlide(deck(), "s1");
    expect(ids(next.body)).toEqual(["s2", "s3"]);
    expect(next.body.sections[0].firstSlideId).toBe("s2");
  });

  it("a deck keeps its last slide", () => {
    const one = deck({ slides: [deck().slides[0]], sections: [] });
    expect(withoutSlide(one, "s1").ops).toEqual([]);
  });

  it("moves and steps", () => {
    expect(ids(withMovedSlide(deck(), "s3", null).body)).toEqual(["s3", "s1", "s2"]);
    expect(ids(stepped(deck(), "s3", "up").body)).toEqual(["s1", "s3", "s2"]);
    expect(stepped(deck(), "s1", "up").ops).toEqual([]);
  });

  it("saves a slide as a layout that locks a copy of everything on it", () => {
    const saved = withSavedLayout(deck(), "s1", " Board opener ");
    const layout = saved.body.layouts[1];
    expect(layout.name).toBe("Board opener");
    expect(layout.key).toBe(layout.id);
    expect(layout.placeholders).toEqual([]);
    expect(layout.locked).toHaveLength(3);
    expect(layout.locked.map((element) => element.id)).not.toContain("e1");
    expect(saved.body.slides[0].elements).toHaveLength(3);

    const fresh = withNewSlide(saved.body, "s1", layout.key);
    expect(fresh.body.slides[1].layoutKey).toBe(layout.key);
    expect(fresh.body.slides[1].elements).toEqual([]);
  });
});

describe("elements", () => {
  it("sets a frame by the element's own id", () => {
    const next = withElementFrame(deck(), "e2", frame(0.5));
    expect(next.body.slides[0].elements[1].frame.x).toBe(0.5);
    expect(next.ops[0]).toMatchObject({ op: "set", path: "e2/frame" });
  });

  it("a set that changes nothing is no op", () => {
    expect(withSet(deck(), "e2/frame", frame(0.4)).ops).toEqual([]);
    expect(valueAt(deck(), "theme/colors/text")).toBe("--token-ink-primary");
  });

  it("restacks within the slide", () => {
    const front = withRestacked(deck(), "e1", "front");
    expect(front.body.slides[0].elements.map((element) => element.id)).toEqual(["e2", "e3", "e1"]);
    const back = withRestacked(front.body, "e3", "back");
    expect(back.body.slides[0].elements.map((element) => element.id)).toEqual(["e3", "e2", "e1"]);
    expect(withRestacked(deck(), "e3", "front").ops).toEqual([]);
  });

  it("restacks a selection as a block, in the order it had", () => {
    const back = withRestackedSet(deck(), ["e3", "e2"], "back");
    expect(back.body.slides[0].elements.map((element) => element.id)).toEqual(["e2", "e3", "e1"]);
    const forward = withRestackedSet(deck(), ["e1", "e2"], "forward");
    expect(forward.body.slides[0].elements.map((element) => element.id)).toEqual(["e3", "e1", "e2"]);
    expect(withRestackedSet(deck(), ["e2", "e3"], "front").ops).toEqual([]);
  });

  it("groups into relative frames and ungroups back to the same places", () => {
    const grouped = withGrouped(deck(), ["e2", "e3"]);
    const group = grouped.body.slides[0].elements[1];
    expect(group.content.type).toBe("group");
    expect(group.frame.x).toBeCloseTo(0.4);
    expect(group.frame.y).toBeCloseTo(0.1);
    expect(group.frame.width).toBeCloseTo(0.5);
    expect(group.frame.height).toBeCloseTo(0.2);
    if (group.content.type !== "group") throw new Error("not a group");
    expect(group.content.children[0].frame.x).toBe(0);
    expect(group.content.children[1].frame.x).toBeCloseTo(0.6);

    const placed = placedOn(grouped.body.slides[0]).find((held) => held.element.id === "e3");
    expect(placed?.frame.x).toBeCloseTo(0.7);
    expect(placed?.parents).toEqual([group.id]);

    const back = withUngrouped(grouped.body, group.id);
    expect(back.body.slides[0].elements.map((element) => element.id)).toEqual(["e1", "e2", "e3"]);
    expect(back.body.slides[0].elements[2].frame.x).toBeCloseTo(0.7);
  });

  it("moves a grouped child by an absolute frame", () => {
    const grouped = withGrouped(deck(), ["e2", "e3"]);
    const moved = withElementFrame(grouped.body, "e3", frame(0.75));
    const placed = placedOn(moved.body.slides[0]).find((held) => held.element.id === "e3");
    expect(placed?.frame.x).toBeCloseTo(0.75);
  });

  it("removes a child from inside a group", () => {
    const grouped = withGrouped(deck(), ["e2", "e3"]);
    const removed = withoutElements(grouped.body, ["e3"]);
    const group = removed.body.slides[0].elements[1];
    if (group.content.type !== "group") throw new Error("not a group");
    expect(group.content.children.map((child) => child.id)).toEqual(["e2"]);
  });

  it("labels an element by what it is", () => {
    const [textBox, rect] = deck().slides[0].elements;
    expect(labelOf(textBox)).toBe("One");
    expect(labelOf(rect)).toBe("Shape");
  });
});
