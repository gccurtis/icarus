import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { atomValidator, blockValidator, markValidator } from "$content/types/block";

/** Variants are found by their `type` literal, never by index. */
const variant = (type: string) => {
  const found = blockValidator.members.find((member) => member.fields.type.value === type);
  if (found === undefined) throw new Error(`no '${type}' block variant`);
  return found.fields as Record<string, unknown>;
};

const types = () => blockValidator.members.map((member) => member.fields.type.value as string);

const literal = { id: "a1", kind: "literal", text: "Revenue was " };

const formulaAtom = {
  id: "a2",
  kind: "formula",
  expression: "SUM(Sales!B:B)",
  lastResolvedValue: { kind: "number", value: 4_200_000 },
  lastResolvedDisplay: "$4.2M",
  state: "fresh"
};

const paragraph = {
  id: "b1",
  type: "text",
  variant: "paragraph",
  atoms: [literal],
  display: "Revenue was ",
  marks: []
};

describe("blockValidator", () => {
  it("names six variants, and the whole union ships at once", () => {
    expect(types().sort()).toEqual(["analytic", "formula", "image", "prompt", "table", "text"]);
  });

  it("holds no embed variant", () => {
    // A URL is a `link` mark on a span. A block-level version would be a second
    // way to say it, and the card, title, and preview behind it are decoration
    // fetched from somewhere we do not control.
    expect(types()).not.toContain("embed");
  });

  it("holds no divider or page break", () => {
    // They hold no content, take no marks, and cannot be searched — they are row
    // kinds. Content and structure split there.
    for (const absent of ["divider", "pageBreak", "page-break"]) {
      expect(types()).not.toContain(absent);
    }
  });

  /**
   * The real failure mode is not appending a member. It is collapsing the union
   * into one wide object with per-type optional fields, at which point every
   * variant silently accepts every other variant's fields.
   */
  describe("each variant owns its whole field set", () => {
    it("gives a text block atoms and no expression", () => {
      expect(Object.keys(variant("text"))).toContain("atoms");
      expect(Object.keys(variant("text"))).not.toContain("expression");
      expect(validate(blockValidator, { ...paragraph, expression: "SUM(A:A)" })).toBe(false);
    });

    it("gives a formula block an expression and no atoms", () => {
      expect(Object.keys(variant("formula"))).toContain("expression");
      expect(Object.keys(variant("formula"))).toContain("formulaId");
      expect(Object.keys(variant("formula"))).not.toContain("atoms");
    });

    it("gives an image block a source and none of the text machinery", () => {
      expect(Object.keys(variant("image"))).toContain("source");
      expect(Object.keys(variant("image"))).not.toContain("marks");
    });

    it("gives a prompt block a derived output and the same text machinery", () => {
      const prompt = Object.keys(variant("prompt"));
      expect(prompt).toContain("derivedOutputId");
      for (const shared of ["atoms", "display", "marks"]) expect(prompt).toContain(shared);
    });

    it("gives an analytic block one live analysis reference and no copied chart data", () => {
      const analytic = Object.keys(variant("analytic"));
      expect(analytic).toContain("analyticId");
      expect(analytic).toContain("showTitle");
      expect(analytic).not.toContain("chart");
      expect(
        validate(blockValidator, {
          id: "b-analytic",
          type: "analytic",
          analyticId: "an-1",
          showTitle: false
        })
      ).toBe(true);
    });
  });

  describe("what a template body has to survive", () => {
    it("admits a prompt block with no derived output, idle and unscoped", () => {
      // A prompt block written into a template is stripped of everything
      // project-bound. Both fields being optional is what makes that storable.
      expect(
        validate(blockValidator, {
          id: "b4",
          type: "prompt",
          atoms: [literal],
          display: "Revenue was ",
          marks: [],
          state: "idle"
        })
      ).toBe(true);
    });

    it("admits a formula block with an expression and no row", () => {
      // The expression is the portable form; the row is scoped to one project
      // and names rows and columns that do not exist where a template lands.
      expect(
        validate(blockValidator, {
          id: "b5",
          type: "formula",
          expression: "SUM(Sales!B:B)",
          display: "$4.2M",
          value: { kind: "number", value: 4_200_000 },
          state: "fresh"
        })
      ).toBe(true);
    });
  });

  describe("what it refuses", () => {
    it("refuses a text block with no display string", () => {
      const { display, ...withoutDisplay } = paragraph;
      expect(display).toBe("Revenue was ");
      expect(validate(blockValidator, withoutDisplay)).toBe(false);
    });

    it("refuses a text block with no marks array", () => {
      const { marks, ...withoutMarks } = paragraph;
      expect(marks).toEqual([]);
      expect(validate(blockValidator, withoutMarks)).toBe(false);
    });

    it("refuses a text variant it does not name", () => {
      expect(validate(blockValidator, { ...paragraph, variant: "callout" })).toBe(false);
    });

    it("refuses a prompt state it does not name", () => {
      const prompt = {
        id: "b6",
        type: "prompt",
        atoms: [literal],
        display: "Revenue was ",
        marks: [],
        state: "computing"
      };
      expect(validate(blockValidator, prompt)).toBe(false);
      expect(validate(blockValidator, { ...prompt, state: "generating" })).toBe(true);
    });

    it("refuses a block with no id", () => {
      const { id, ...withoutId } = paragraph;
      expect(id).toBe("b1");
      expect(validate(blockValidator, withoutId)).toBe(false);
    });
  });

  describe("an image", () => {
    const image = { id: "b2", type: "image", alt: "A chart" };

    it("stands on its own with no source at all", () => {
      // Absent is a picture's place without a picture in it: the alt text, the
      // caption, the crop, and the frame all stand on their own.
      expect(validate(blockValidator, image)).toBe(true);
    });

    it("names its bytes three ways, and exactly one applies", () => {
      for (const source of [
        { kind: "file", fileId: "f1" },
        { kind: "storage", storageId: "s1" },
        { kind: "url", url: "https://example.com/chart.png" }
      ]) {
        expect(validate(blockValidator, { ...image, source })).toBe(true);
      }
    });

    it("carries no rendered display asset beside the source", () => {
      // One row, one blob. An external file holds a single object, reduced on
      // the way in, so there is no display-sized copy to reference.
      expect(Object.keys(variant("image"))).not.toContain("display");
    });

    it("refuses an image with no alt text", () => {
      // An image without it is a hole in every non-visual consumer: search, the
      // lattice, screen readers, and any agent reading the document.
      const { alt, ...withoutAlt } = image;
      expect(alt).toBe("A chart");
      expect(validate(blockValidator, withoutAlt)).toBe(false);
    });
  });

  it("cannot reject a malformed block nested in a table cell", () => {
    // The cell is `v.any()` because the recursion is real and a validator is a
    // value, not a type. The bound is the owner's: no surface accepting a table
    // accepts one nested in a cell.
    expect(
      validate(blockValidator, {
        id: "b3",
        type: "table",
        headerRows: 1,
        rows: [{ id: "r1", cells: [{ id: "c1", blocks: [{ nonsense: true }] }] }]
      })
    ).toBe(true);
  });
});

describe("atomValidator", () => {
  it("holds the expression and the row it evaluates in", () => {
    // The expression is what the author wrote and travels between projects; the
    // row is what evaluates it and exists only in one.
    expect(validate(atomValidator, formulaAtom)).toBe(true);
    expect(validate(atomValidator, { ...formulaAtom, formulaId: "fx1" })).toBe(true);
  });

  it("carries both halves of its last result", () => {
    // The value is what other computations read; the display is the span the
    // block's `display` concatenates and the marks index.
    const { lastResolvedDisplay, ...withoutDisplay } = formulaAtom;
    expect(lastResolvedDisplay).toBe("$4.2M");
    expect(validate(atomValidator, withoutDisplay)).toBe(false);

    const { lastResolvedValue, ...withoutValue } = formulaAtom;
    expect(lastResolvedValue).toEqual({ kind: "number", value: 4_200_000 });
    expect(validate(atomValidator, withoutValue)).toBe(false);
  });

  it("keeps a stale result readable, so a block renders without re-evaluating", () => {
    expect(validate(atomValidator, { ...formulaAtom, state: "stale" })).toBe(true);
  });

  describe("what it refuses", () => {
    it("refuses an atom with no id", () => {
      // Atom ids give the finest merge granularity in the model.
      expect(validate(atomValidator, { kind: "literal", text: "hello" })).toBe(false);
    });

    it("refuses a resolution state that is not one of the four", () => {
      expect(validate(atomValidator, { ...formulaAtom, state: "pending" })).toBe(false);
    });

    it("refuses a formula atom with no expression", () => {
      const { expression, ...withoutExpression } = formulaAtom;
      expect(expression).toBe("SUM(Sales!B:B)");
      expect(validate(atomValidator, withoutExpression)).toBe(false);
    });
  });
});

describe("markValidator", () => {
  const span = { id: "m1", from: 0, to: 8 };

  it("points at a URL, an actor, a persona, or a resource", () => {
    // All four are the same act: this run of text points elsewhere.
    for (const link of [
      { kind: "url", url: "https://example.com" },
      { kind: "actor", actor: { kind: "user", userId: "u1" } },
      { kind: "persona", personaId: "p1" },
      { kind: "resource", ref: { kind: "document", id: "d1" } }
    ]) {
      expect(validate(markValidator, { ...span, link })).toBe(true);
    }
  });

  it("keeps a persona apart from an actor", () => {
    // An actor's `agent` points at a task — the run that acted. A persona is the
    // durable identity, and mentioning one is not naming a unit of work.
    expect(
      validate(markValidator, {
        ...span,
        link: { kind: "actor", actor: { kind: "persona", personaId: "p1" } }
      })
    ).toBe(false);
    expect(
      validate(markValidator, {
        ...span,
        link: { kind: "actor", actor: { kind: "agent", taskId: "t1" } }
      })
    ).toBe(true);
  });

  it("carries no mention field beside the link", () => {
    // A mention is a link at someone, so it is an arm of `link` rather than a
    // second field — which is what stops a span pointing at two things.
    expect(Object.keys(markValidator.fields)).not.toContain("mention");
  });

  it("refuses a link kind it does not name", () => {
    expect(validate(markValidator, { ...span, link: { kind: "embed", url: "x" } })).toBe(false);
    expect(validate(markValidator, { ...span, link: "https://example.com" })).toBe(false);
  });

  it("carries an id, so two people bolding different words merge", () => {
    expect(validate(markValidator, { from: 0, to: 4, style: ["bold"] })).toBe(false);
  });

  it("refuses a style it does not name", () => {
    expect(validate(markValidator, { ...span, style: ["highlight"] })).toBe(false);
  });

  it("requires both offsets", () => {
    expect(validate(markValidator, { id: "m1", from: 0 })).toBe(false);
  });
});
