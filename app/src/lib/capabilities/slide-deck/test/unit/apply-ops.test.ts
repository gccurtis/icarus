import { describe, expect, it } from "vitest";
import type { Mark, TextBlock } from "$representation/data/types/content/content-block";
import type { SlideDeckBody, SlideElement } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import { applyOps } from "$capabilities/slide-deck/api/submit-slide-deck-changes/apply-ops";

const frame = (x: number) => ({ x, y: 0.1, width: 0.4, height: 0.2 });

const text = (id: string, display: string, marks: Mark[] = []): TextBlock => ({
  id,
  type: "text" as const,
  variant: "paragraph" as const,
  atoms: [{ id: `${id}-a`, kind: "literal" as const, text: display }],
  display,
  marks
});

const shape = (id: string, x: number): SlideElement => ({
  id,
  frame: frame(x),
  content: { type: "shape", shape: "rectangle" }
});

const body = (): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body", fontSize: 20 } } },
  layouts: [],
  sections: [{ id: "sec1", name: "One", firstSlideId: "s1" }],
  slides: [
    {
      id: "s1",
      notes: [text("n1", "Say hello")],
      elements: [
        {
          id: "t1",
          frame: frame(0.1),
          content: {
            type: "text",
            block: text("b1", "Hello world", [
              {
                id: "m1",
                from: { atom: "b1-a", offset: 0 },
                to: { atom: "b1-a", offset: 5 }
              }
            ])
          }
        },
        shape("e1", 0.1)
      ]
    },
    { id: "s2", notes: [], elements: [shape("e2", 0.2), shape("e3", 0.3)] }
  ]
});

const set = (
  target: Extract<SlideDeckOp, { op: "set" }>["target"],
  path: string,
  value: unknown,
  was: unknown = undefined
): SlideDeckOp => ({
  op: "set",
  target,
  path,
  value,
  was
});

const shapeIn = (deck: SlideDeckBody, slide: number, index: number) => deck.slides[slide].elements[index];

describe("set", () => {
  it("moves an element by its own id, whichever slide holds it", () => {
    const next = applyOps(body(), [set("element", "e2/frame", frame(0.9))]);

    expect(shapeIn(next, 1, 0).frame.x).toBe(0.9);
    expect(shapeIn(next, 0, 1).frame.x).toBe(0.1);
  });

  it("leaves the slide it did not touch alone", () => {
    const before = body();
    const next = applyOps(before, [set("element", "e1/frame", frame(0.5))]);

    expect(next.slides[1]).toBe(before.slides[1]);
  });

  it("reaches a field nested under an element", () => {
    const next = applyOps(body(), [set("element", "e1/paint/fill", "--token-color-accent-2-fill")]);

    expect(shapeIn(next, 0, 1).paint?.fill).toBe("--token-color-accent-2-fill");
  });

  it("reaches a field on the deck itself", () => {
    const next = applyOps(body(), [
      set("deck", "theme/colors/text", "--token-ink-secondary"),
      set("deck", "aspectRatio", "4:3")
    ]);

    expect(next.theme.colors.text).toBe("--token-ink-secondary");
    expect(next.aspectRatio).toBe("4:3");
  });

  it("reaches a field on a slide and on a section", () => {
    const next = applyOps(body(), [
      set("slide", "s2/hidden", true),
      set("section", "sec1/firstSlideId", "s2")
    ]);

    expect(next.slides[1].hidden).toBe(true);
    expect(next.sections[0].firstSlideId).toBe("s2");
  });

  it("removes a field when the value is null", () => {
    const withRotation = applyOps(body(), [set("element", "e1/rotation", 45)]);
    const next = applyOps(withRotation, [set("element", "e1/rotation", null)]);

    expect("rotation" in shapeIn(next, 0, 1)).toBe(false);
  });

  it("refuses an id it cannot find", () => {
    expect(() => applyOps(body(), [set("element", "nope/frame", frame(0.5))]))
      .toThrow(/Nothing in the deck has the id nope/);
  });

  it("refuses to set a list", () => {
    expect(() => applyOps(body(), [set("slide", "s1/elements", [])])).toThrow(/is a list/);
  });

  it("refuses to walk into a primitive", () => {
    expect(() => applyOps(body(), [set("element", "e1/frame/x/deeper", 1)]))
      .toThrow(/holds no fields/);
  });
});

describe("elements", () => {
  it("inserts, removes and restacks elements on a slide", () => {
    const fresh = shape("e9", 0.5);
    const inserted = applyOps(body(), [
      { op: "insert", target: "element", path: "s2/elements", ids: ["e9"], after: "e2", values: [fresh] }
    ]);
    expect(inserted.slides[1].elements.map((element) => element.id)).toEqual(["e2", "e9", "e3"]);

    const moved = applyOps(inserted, [
      { op: "move", target: "element", path: "s2/elements", id: "e9", after: null, wasAfter: "e2" }
    ]);
    expect(moved.slides[1].elements.map((element) => element.id)).toEqual(["e9", "e2", "e3"]);

    const removed = applyOps(moved, [
      { op: "remove", target: "element", path: "s2/elements", ids: ["e9"], after: null, values: [fresh] }
    ]);
    expect(removed.slides[1].elements.map((element) => element.id)).toEqual(["e2", "e3"]);
  });

  it("reaches an element inside a group", () => {
    const grouped = applyOps(body(), [
      { op: "remove", target: "element", path: "s2/elements", ids: ["e2", "e3"], after: null, values: [] },
      {
        op: "insert",
        target: "element",
        path: "s2/elements",
        ids: ["g1"],
        after: null,
        values: [{ id: "g1", frame: frame(0.2), content: { type: "group", children: [shape("e2", 0), shape("e3", 0.5)] } }]
      }
    ]);
    const next = applyOps(grouped, [set("element", "e3/frame", frame(0.75))]);

    const group = next.slides[1].elements[0];
    expect(group.content.type).toBe("group");
    if (group.content.type === "group") expect(group.content.children[1].frame.x).toBe(0.75);
  });
});

describe("text", () => {
  const type = (at: number, insert: string, remove = ""): SlideDeckOp => ({
    op: "text",
    target: "atom",
    path: "b1/atoms/b1-a",
    at,
    insert,
    remove
  });

  const blockOf = (deck: SlideDeckBody) => {
    const content = deck.slides[0].elements[0].content;
    if (content.type !== "text") throw new Error("not text");
    return content.block;
  };

  it("splices a literal and recomputes the display", () => {
    const next = applyOps(body(), [type(5, " big", "")]);

    expect(blockOf(next).display).toBe("Hello big world");
  });

  it("refuses text that has moved", () => {
    expect(() => applyOps(body(), [type(0, "", "Yello")])).toThrow(/authored against text that has moved/);
  });

  it("carries a mark past an insertion before it", () => {
    const next = applyOps(body(), [type(0, ">> ", "")]);

    expect(blockOf(next).marks[0]).toMatchObject({
      from: { atom: "b1-a", offset: 3 },
      to: { atom: "b1-a", offset: 8 }
    });
  });

  it("grows a mark that an insertion lands inside", () => {
    const next = applyOps(body(), [type(2, "LL", "")]);

    expect(blockOf(next).marks[0]).toMatchObject({
      from: { atom: "b1-a", offset: 0 },
      to: { atom: "b1-a", offset: 7 }
    });
  });

  it("drops a mark whose whole range is deleted", () => {
    const next = applyOps(body(), [type(0, "", "Hello ")]);

    expect(blockOf(next).marks).toEqual([]);
    expect(blockOf(next).display).toBe("world");
  });

  it("reaches the notes on a slide", () => {
    const next = applyOps(body(), [{ ...type(3, " there", ""), path: "n1/atoms/n1-a" }]);

    expect((next.slides[0].notes[0] as { display: string }).display).toBe("Say there hello");
  });
});

describe("marks", () => {
  it("adds, retunes and removes a mark by id", () => {
    const added = applyOps(body(), [
      {
        op: "insert",
        target: "mark",
        path: "b1/marks",
        ids: ["m2"],
        after: "m1",
        values: [
          {
            id: "m2",
            from: { atom: "b1-a", offset: 6 },
            to: { atom: "b1-a", offset: 11 },
            style: ["italic"]
          }
        ]
      }
    ]);
    const tuned = applyOps(added, [set("mark", "m2/style", ["bold", "italic"])]);
    const content = tuned.slides[0].elements[0].content;
    if (content.type !== "text") throw new Error("not text");
    expect(content.block.marks[1]).toMatchObject({ id: "m2", style: ["bold", "italic"] });

    const removed = applyOps(tuned, [
      { op: "remove", target: "mark", path: "b1/marks", ids: ["m1"], after: null, values: [] }
    ]);
    const after = removed.slides[0].elements[0].content;
    if (after.type !== "text") throw new Error("not text");
    expect(after.block.marks.map((mark) => mark.id)).toEqual(["m2"]);
  });
});

describe("slides", () => {
  it("reorders slides, so a deck can be arranged", () => {
    const next = applyOps(body(), [
      { op: "move", target: "slide", path: "slides", id: "s2", after: null, wasAfter: "s1" }
    ]);

    expect(next.slides.map((slide) => slide.id)).toEqual(["s2", "s1"]);
  });

  it("applies a run of ops in order", () => {
    const next = applyOps(body(), [
      set("element", "e1/frame", frame(0.3)),
      set("element", "e1/frame", frame(0.7))
    ]);

    expect(shapeIn(next, 0, 1).frame.x).toBe(0.7);
  });
});
