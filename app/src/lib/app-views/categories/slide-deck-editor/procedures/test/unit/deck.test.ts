import { describe, expect, it } from "vitest";

import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import {
  stepped,
  withDuplicatedSlide,
  withMovedSlide,
  withNewSlide,
  withoutSlide
} from "$app-views/categories/slide-deck-editor/procedures/deck";

const frame = (x: number) => ({ x, y: 0.1, width: 0.4, height: 0.2 });

const text = (id: string, display: string) => ({
  id,
  type: "text" as const,
  variant: "paragraph" as const,
  atoms: [{ id: `${id}-a`, kind: "literal" as const, text: display }],
  display,
  marks: [{ id: `${id}-m`, from: 0, to: 3 }]
});

const deck = (over: Partial<SlideDeckBody> = {}): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body", fontSize: 20 } } },
  layouts: [],
  sections: [],
  slides: [
    {
      id: "s1",
      layoutKey: "title-only",
      notes: [],
      elements: [
        { id: "e1", frame: frame(0.1), overflow: "clip", blocks: [text("b1", "One")] }
      ]
    },
    { id: "s2", notes: [], elements: [] },
    { id: "s3", notes: [], elements: [] }
  ],
  ...over
});

/** What the applier makes of the ops must be what the producer already returned. */
const agrees = (before: SlideDeckBody, edit: { body: SlideDeckBody; ops: readonly unknown[] }) =>
  expect(applyOps(before, edit.ops as never)).toEqual(edit.body);

const order = (body: SlideDeckBody) => body.slides.map((slide) => slide.id);

describe("a slide is added", () => {
  it("lands after the one it was asked for, carrying its layout", () => {
    const before = deck();
    const edit = withNewSlide(before, "s1");

    expect(order(edit.body)).toEqual(["s1", expect.any(String), "s2", "s3"]);
    expect(edit.body.slides[1].layoutKey).toBe("title-only");
    expect(edit.body.slides[1].elements).toEqual([]);
    agrees(before, edit);
  });

  it("lands at the front when it follows nothing", () => {
    const before = deck();
    const edit = withNewSlide(before, undefined);

    expect(edit.ops[0]).toMatchObject({ op: "insert", target: "slide", after: null });
    expect(order(edit.body).slice(1)).toEqual(["s1", "s2", "s3"]);
    agrees(before, edit);
  });
});

describe("a slide is duplicated", () => {
  it("shares no identity with its original", () => {
    const before = deck();
    const edit = withDuplicatedSlide(before, "s1");
    const copy = edit.body.slides[1];
    const original = before.slides[0];

    expect(copy.id).not.toBe(original.id);
    expect(copy.elements[0].id).not.toBe(original.elements[0].id);
    expect(copy.elements[0].blocks[0].id).not.toBe(original.elements[0].blocks[0].id);

    const block = copy.elements[0].blocks[0];
    if (block.type !== "text") throw new Error("the copy lost its text block");
    expect(block.atoms[0].id).not.toBe("b1-a");
    expect(block.marks[0].id).not.toBe("b1-m");
    agrees(before, edit);
  });

  it("keeps everything that is not an identity", () => {
    const edit = withDuplicatedSlide(deck(), "s1");
    const block = edit.body.slides[1].elements[0].blocks[0];

    expect(edit.body.slides[1].layoutKey).toBe("title-only");
    expect(edit.body.slides[1].elements[0].frame).toEqual(frame(0.1));
    if (block.type !== "text") throw new Error("the copy lost its text block");
    expect(block.display).toBe("One");
  });

  it("says nothing about a slide that is not there", () => {
    expect(withDuplicatedSlide(deck(), "nope").ops).toEqual([]);
  });
});

describe("a slide is removed", () => {
  it("carries what it removed, so the removal inverts", () => {
    const before = deck();
    const edit = withoutSlide(before, "s2");

    expect(order(edit.body)).toEqual(["s1", "s3"]);
    expect(edit.ops.at(-1)).toMatchObject({
      op: "remove",
      target: "slide",
      ids: ["s2"],
      after: "s1",
      values: [before.slides[1]]
    });
    agrees(before, edit);
  });

  it("re-anchors a section to whatever now begins it", () => {
    const before = deck({ sections: [{ id: "sec-1", name: "Middle", firstSlideId: "s2" }] });
    const edit = withoutSlide(before, "s2");

    expect(edit.body.sections[0].firstSlideId).toBe("s3");
    expect(edit.ops[0]).toMatchObject({
      op: "set",
      target: "section",
      path: "sec-1/firstSlideId",
      value: "s3",
      was: "s2"
    });
    agrees(before, edit);
  });

  it("drops a section with nothing left to begin it", () => {
    const before = deck({ sections: [{ id: "sec-1", name: "Last", firstSlideId: "s3" }] });
    const edit = withoutSlide(before, "s3");

    expect(edit.body.sections).toEqual([]);
    expect(edit.ops[0]).toMatchObject({ op: "remove", target: "section", ids: ["sec-1"] });
    agrees(before, edit);
  });
});

describe("a slide is moved", () => {
  it("names where it came from, so the move inverts", () => {
    const before = deck();
    const edit = withMovedSlide(before, "s3", null);

    expect(order(edit.body)).toEqual(["s3", "s1", "s2"]);
    expect(edit.ops[0]).toMatchObject({ op: "move", id: "s3", after: null, wasAfter: "s2" });
    agrees(before, edit);
  });

  it("leaves a section anchored where it is, so the boundary re-reads", () => {
    const before = deck({ sections: [{ id: "sec-1", name: "From two", firstSlideId: "s2" }] });
    const edit = withMovedSlide(before, "s2", null);

    expect(order(edit.body)).toEqual(["s2", "s1", "s3"]);
    expect(edit.body.sections[0].firstSlideId).toBe("s2");
  });

  it("says nothing when the slide is already there", () => {
    expect(withMovedSlide(deck(), "s2", "s1").ops).toEqual([]);
    expect(withMovedSlide(deck(), "s1", "s1").ops).toEqual([]);
  });
});

describe("a slide steps one place", () => {
  it("goes up past the one above it", () => {
    expect(order(stepped(deck(), "s3", "up").body)).toEqual(["s1", "s3", "s2"]);
    expect(order(stepped(deck(), "s2", "up").body)).toEqual(["s2", "s1", "s3"]);
  });

  it("goes down past the one below it", () => {
    expect(order(stepped(deck(), "s1", "down").body)).toEqual(["s2", "s1", "s3"]);
  });

  it("has nowhere to go at either end", () => {
    expect(stepped(deck(), "s1", "up").ops).toEqual([]);
    expect(stepped(deck(), "s3", "down").ops).toEqual([]);
  });
});
