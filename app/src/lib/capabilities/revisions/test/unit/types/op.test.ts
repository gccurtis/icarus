import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import { opTargetValidator, opValidator } from "$revisions/types/op";

const names = () => opValidator.members.map((member) => member.fields.op.value as string);
const arm = (name: string) => opValidator.members.find((member) => member.fields.op.value === name)!;
const targets = () => opTargetValidator.members.map((member) => member.value as string);

describe("opValidator", () => {
  it("names five ops", () => {
    expect(names().sort()).toEqual(["insert", "move", "remove", "set", "text"]);
  });

  it("names no op after what it acts on", () => {
    // `rowInsert`, `blockSet` and `themeSet` would encode in the op name what the
    // path already encodes, and every new field in any body would need a new op.
    for (const typed of ["rowInsert", "blockSet", "themeSet", "cellSet"]) {
      expect(names()).not.toContain(typed);
    }
  });

  describe("every op is closed under inversion", () => {
    // This is the property the client depends on: inverting an op is a swap of
    // its own payload fields, so an undo can be assembled without reading a body.

    it("carries what a set replaced", () => {
      expect(Object.keys(arm("set").fields).sort()).toEqual([
        "op",
        "path",
        "target",
        "value",
        "was"
      ]);
    });

    it("carries what a remove took out, and where it sat", () => {
      expect(Object.keys(arm("remove").fields)).toContain("values");
      expect(Object.keys(arm("remove").fields)).toContain("after");
    });

    it("carries where a move came from", () => {
      expect(Object.keys(arm("move").fields)).toContain("wasAfter");
    });

    it("carries both sides of a text edit", () => {
      expect(Object.keys(arm("text").fields)).toContain("insert");
      expect(Object.keys(arm("text").fields)).toContain("remove");
    });

    it("carries the ids an insert put in, so a remove can name them", () => {
      // Stage 0 gave `insert` only `values`, and a remove names *ids* — so
      // inverting one would have meant reading an id out of each opaque value.
      // With `ids` the two ops are exact mirrors.
      expect(Object.keys(arm("insert").fields).sort()).toEqual([
        "after",
        "ids",
        "op",
        "path",
        "target",
        "values"
      ]);
    });

    it("makes insert and remove mirror images", () => {
      // Same fields, opposite direction: inverting either is a change of op name.
      expect(Object.keys(arm("insert").fields).sort()).toEqual(
        Object.keys(arm("remove").fields).sort()
      );
    });
  });

  it("pins a text op to an atom, and nothing else is pinned", () => {
    // A formula atom is changed by `set`ting its formulaId, which keeps the one
    // in-place string edit in the system to one kind of string.
    expect(arm("text").fields.target.kind).toBe("literal");
    expect(arm("set").fields.target.kind).toBe("union");

    expect(
      validate(opValidator, {
        op: "text",
        target: "row",
        path: "rows/#r1",
        at: 0,
        insert: "a",
        remove: ""
      })
    ).toBe(false);
  });

  it("accepts a head insert, which is what a null `after` means", () => {
    expect(
      validate(opValidator, {
        op: "insert",
        target: "row",
        path: "rows",
        ids: ["r1"],
        after: null,
        values: [{ kind: "text" }]
      })
    ).toBe(true);
  });

  it("cannot reject a malformed payload, and that is the accepted cost", () => {
    // A payload is `v.any()` because an op is generic over three body shapes.
    // Everything outside one is still checked at the door.
    expect(
      validate(opValidator, {
        op: "set",
        target: "field",
        path: "page/margins",
        value: { nonsense: true },
        was: null
      })
    ).toBe(true);
  });

  it("says 'nothing was there' with null, because a stored value is never undefined", () => {
    // `was` is required, and `v.any()` does not admit `undefined` — an absent
    // field and a field holding undefined are the same thing to Convex. So
    // setting something that did not exist inverts to `was: null`, and an op
    // that omitted `was` would be inverted into a set to nothing at all.
    const absent = { op: "set", target: "field", path: "page/header", value: 1 };

    expect(validate(opValidator, { ...absent, was: null })).toBe(true);
    expect(validate(opValidator, { ...absent, was: undefined })).toBe(false);
  });

  describe("what it refuses", () => {
    it("refuses a set that does not say what it replaced", () => {
      expect(validate(opValidator, { op: "set", target: "field", path: "page/margins", value: 2 })).toBe(
        false
      );
    });

    it("refuses an unknown op name", () => {
      expect(validate(opValidator, { op: "replace", target: "row", path: "rows/#r1" })).toBe(false);
    });

    it("accepts a chart now that it has ids, source, anchoring and a renderer", () => {
      expect(
        validate(opValidator, { op: "set", target: "chart", path: "charts/#c1", value: 1, was: 0 })
      ).toBe(true);
      expect(
        validate(opValidator, {
          op: "set",
          target: "chartElement",
          path: "charts/#c1/elements/#e1/label",
          value: "Target",
          was: null
        })
      ).toBe(true);
    });

    it("refuses an unknown target", () => {
      expect(
        validate(opValidator, { op: "set", target: "chartPart", path: "charts/#c1", value: 1, was: 0 })
      ).toBe(false);
    });

    it("refuses a path that is not a string", () => {
      expect(validate(opValidator, { op: "set", target: "field", path: ["page"], value: 1, was: 0 })).toBe(
        false
      );
    });
  });
});

describe("opTargetValidator", () => {
  it("names fourteen targets", () => {
    expect(targets().sort()).toEqual([
      "atom",
      "block",
      "cell",
      "chart",
      "chartElement",
      "element",
      "field",
      "mark",
      "mergedCells",
      "range",
      "row",
      "section",
      "sheet",
      "slide"
    ]);
  });

  it("names things, not operations", () => {
    // `merge` read as the verb for the operation being performed on it, where
    // every other member is a noun naming what is acted on.
    expect(targets()).toContain("mergedCells");
    expect(targets()).not.toContain("merge");
  });

  it("has a range, because a path can address one", () => {
    // A formula's operands and a print area both name a range rather than a cell.
    expect(targets()).toContain("range");
  });

  it("separates a chart frame from an element inside it", () => {
    expect(targets()).toContain("chart");
    expect(targets()).toContain("chartElement");
  });
});
