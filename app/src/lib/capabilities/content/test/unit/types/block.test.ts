import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { blockValidator, markValidator, textAtomValidator } from "$content/types/block";

/** Variants are found by their `type` literal, never by index. */
const variant = (type: string) => {
  const found = blockValidator.members.find((member) => member.fields.type.value === type);
  if (found === undefined) throw new Error(`no '${type}' block variant`);
  return found.fields as Record<string, unknown>;
};

const types = () => blockValidator.members.map((member) => member.fields.type.value as string);

const literal = { id: "a1", kind: "literal", text: "Revenue was " };
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
    // `prompt` names a table many passes away, which costs nothing: every id here
    // is a plain string, so no validator names a table Convex would reject.
    expect(types().sort()).toEqual(["embed", "formula", "image", "prompt", "table", "text"]);
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
      expect(Object.keys(variant("text"))).not.toContain("formulaId");
      expect(validate(blockValidator, { ...paragraph, formulaId: "f1" })).toBe(false);
    });

    it("gives a formula block a formulaId and no atoms", () => {
      expect(Object.keys(variant("formula"))).toContain("formulaId");
      expect(Object.keys(variant("formula"))).not.toContain("atoms");
      expect(Object.keys(variant("formula"))).not.toContain("expression");
    });

    it("gives an image block a source and no display string", () => {
      expect(Object.keys(variant("image"))).toContain("source");
      expect(Object.keys(variant("image"))).not.toContain("marks");
    });

    it("gives a prompt block a derived output and the same text machinery", () => {
      const prompt = Object.keys(variant("prompt"));
      expect(prompt).toContain("derivedOutputId");
      for (const shared of ["atoms", "display", "marks"]) expect(prompt).toContain(shared);
    });
  });

  it("holds no divider or page break", () => {
    // They hold no content, take no marks, and cannot be searched — they are row
    // kinds. Content and structure split there.
    for (const absent of ["divider", "pageBreak", "page-break"]) {
      expect(types()).not.toContain(absent);
    }
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

    it("refuses an image with no alt text", () => {
      // An image without it is a hole in every non-visual consumer: search, the
      // lattice, screen readers, and any agent reading the document.
      const image = { id: "b2", type: "image", source: { kind: "file", fileId: "f1" }, alt: "A chart" };
      expect(validate(blockValidator, image)).toBe(true);

      const { alt, ...withoutAlt } = image;
      expect(alt).toBe("A chart");
      expect(validate(blockValidator, withoutAlt)).toBe(false);
    });

    it("refuses a block with no id", () => {
      const { id, ...withoutId } = paragraph;
      expect(id).toBe("b1");
      expect(validate(blockValidator, withoutId)).toBe(false);
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

describe("textAtomValidator", () => {
  it("holds a formulaId and never an expression", () => {
    // Only the formula row can give an up-to-date rendering: a cell that moves
    // changes what the expression reads as without changing what it means.
    const formula = textAtomValidator.members.find(
      (member) => member.fields.kind.value === "formula"
    );

    expect(Object.keys(formula!.fields)).toContain("formulaId");
    expect(Object.keys(formula!.fields)).not.toContain("expression");
  });

  it("carries resolved and state, so a block reads while a formula is stale", () => {
    expect(
      validate(textAtomValidator, {
        id: "a2",
        kind: "formula",
        formulaId: "f1",
        resolved: "$4.2M",
        state: "stale"
      })
    ).toBe(true);
  });

  describe("what it refuses", () => {
    it("refuses an atom with no id", () => {
      // Atom ids give the finest merge granularity in the model.
      expect(validate(textAtomValidator, { kind: "literal", text: "hello" })).toBe(false);
    });

    it("refuses a resolution state that is not one of the four", () => {
      expect(
        validate(textAtomValidator, {
          id: "a2",
          kind: "formula",
          formulaId: "f1",
          resolved: "",
          state: "pending"
        })
      ).toBe(false);
    });

    it("refuses the old expression-bearing atom", () => {
      expect(
        validate(textAtomValidator, {
          id: "a2",
          kind: "formula",
          expression: "SUM(Sales!B:B)",
          resolved: "$4.2M",
          state: "fresh"
        })
      ).toBe(false);
    });
  });
});

describe("markValidator", () => {
  it("carries a mention, because a mention is a span of typed text", () => {
    // It then shifts when earlier text is edited, survives a merge, and renders
    // inline where it was written — none of which a field beside the blocks does.
    expect(
      validate(markValidator, {
        id: "m1",
        from: 0,
        to: 8,
        mention: { kind: "persona", id: "p1" }
      })
    ).toBe(true);
  });

  it("refuses a mention kind nobody can be addressed by", () => {
    expect(
      validate(markValidator, { id: "m1", from: 0, to: 8, mention: { kind: "system" } })
    ).toBe(false);
  });

  it("carries an id, so two people bolding different words merge", () => {
    expect(validate(markValidator, { from: 0, to: 4, style: ["bold"] })).toBe(false);
  });

  it("refuses a style it does not name", () => {
    expect(validate(markValidator, { id: "m1", from: 0, to: 4, style: ["highlight"] })).toBe(false);
  });

  it("requires both offsets", () => {
    expect(validate(markValidator, { id: "m1", from: 0 })).toBe(false);
  });
});
