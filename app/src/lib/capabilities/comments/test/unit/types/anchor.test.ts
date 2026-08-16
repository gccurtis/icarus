import { describe, expect, it } from "vitest";
import { commentsRefusal } from "$comments/errors";
import {
  commentAnchor,
  commentAnchorValidator,
  type AnchorWithin,
  type CommentTarget
} from "$comments/types/anchor";

/** The payload, never the message: only the payload survives the wire. */
const refusalFrom = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return commentsRefusal(error);
  }
};

const within: Record<AnchorWithin["kind"], AnchorWithin> = {
  slide: { kind: "slide", slideId: "s1" },
  element: { kind: "element", elementId: "e1" },
  cell: { kind: "cell", sheetId: "sh1", ref: "B7" },
  text: { kind: "text", blockId: "b7x2", from: 4, to: 9 }
};

/**
 * The spec's own table, transcribed. It is a cross-field constraint, so no
 * validator can hold it — which is why every pairing is enumerated here rather
 * than trusted to the shape.
 */
const legal: Record<CommentTarget, AnchorWithin["kind"][]> = {
  document: ["text"],
  slides: ["slide", "element", "text"],
  spreadsheet: ["cell", "text"],
  externalFile: [],
  question: ["text"],
  hypothesis: ["text"],
  finding: ["text"]
};

const targets = Object.keys(legal) as CommentTarget[];
const kinds = Object.keys(within) as AnchorWithin["kind"][];

describe("commentAnchorValidator", () => {
  it("names every target the model can hang a discussion on", () => {
    const members = commentAnchorValidator.fields.targetType.members.map((m) => m.value).sort();

    expect(members).toEqual([...targets].sort());
  });

  it("makes within and quote optional, because the whole thing is a legal anchor", () => {
    expect(commentAnchorValidator.fields.within.isOptional).toBe("optional");
    expect(commentAnchorValidator.fields.quote.isOptional).toBe("optional");
  });

  /** Nobody points at a row; they select text, or they comment on the document. */
  it("has no row variant", () => {
    const shapes = commentAnchorValidator.fields.within.members.map((m) => m.fields.kind.value);

    expect(shapes.sort()).toEqual(["cell", "element", "slide", "text"]);
  });
});

describe("commentAnchor", () => {
  it.each(targets)("admits a remark about the whole %s", (targetType) => {
    const anchor = { targetType, targetId: "x1" };

    expect(commentAnchor(anchor)).toEqual(anchor);
  });

  for (const targetType of targets) {
    for (const kind of kinds) {
      const anchor = { targetType, targetId: "x1", within: within[kind] };

      if (legal[targetType].includes(kind)) {
        it(`admits a ${kind} anchor on a ${targetType}`, () => {
          expect(commentAnchor(anchor)).toEqual(anchor);
        });
      } else {
        it(`refuses a ${kind} anchor on a ${targetType}`, () => {
          expect(refusalFrom(() => commentAnchor(anchor))).toMatchObject({
            code: "anchor-mismatch"
          });
        });
      }
    }
  }

  /**
   * The case that matters: "this one needs rework" is about the slide, not about
   * anything on it, and it is a different remark from one about the deck.
   */
  it("tells a deck-level remark apart from a slide-level one", () => {
    const deck = commentAnchor({ targetType: "slides", targetId: "d1" });
    const slide = commentAnchor({ targetType: "slides", targetId: "d1", within: within.slide });

    expect(deck).not.toEqual(slide);
    expect(deck.within).toBeUndefined();
    expect(slide.within).toEqual({ kind: "slide", slideId: "s1" });
  });

  /** An external file has no interior this system can address. */
  it("admits nothing inside an external file", () => {
    for (const kind of kinds) {
      expect(
        refusalFrom(() =>
          commentAnchor({ targetType: "externalFile", targetId: "f1", within: within[kind] })
        )
      ).toMatchObject({ code: "anchor-mismatch" });
    }
  });

  it("keeps the selected text, so a thread reads without loading its target", () => {
    const anchor = {
      targetType: "document" as const,
      targetId: "d1",
      within: within.text,
      quote: "quarterly"
    };

    expect(commentAnchor(anchor).quote).toBe("quarterly");
  });

  it("refuses a range that ends before it starts", () => {
    const anchor = {
      targetType: "document" as const,
      targetId: "d1",
      within: { kind: "text" as const, blockId: "b7x2", from: 9, to: 4 }
    };

    expect(refusalFrom(() => commentAnchor(anchor))).toMatchObject({ code: "anchor-range" });
  });
});
