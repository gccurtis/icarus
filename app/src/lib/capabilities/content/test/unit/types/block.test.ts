import { describe, expect, it } from "vitest";
import { v } from "convex/values";
import { validate } from "convex-helpers/validators";
import {
  blockValidator,
  markValidator,
  textAtomValidator,
  type ContentBlock,
  type TableCell
} from "$content/types/block";
import { formulaValueValidator, type FormulaValue } from "$content/types/value";
// A block is only ever edited through a change set, so the round trip below is
// what "stored" means for a variant.
import { applyOps } from "$revisions/api/shared/apply/apply";

/**
 * The union is the model: what a block can be, and what every block owes
 * whatever holds it. A variant that stops carrying an id, or a text block that
 * stops carrying its resolved display string, fails here rather than in review.
 */

/** Members are looked up by their `type` literal — never by position, so a sixth variant disturbs nothing. */
const fieldsOf = (type: string) => {
  const member = blockValidator.members.find((m) => m.fields.type.value === type);
  return member!.fields as Record<string, { kind: string; isOptional: string }>;
};

const textBlock = {
  id: "b1",
  type: "text",
  variant: "paragraph",
  atoms: [
    { id: "a1", kind: "literal", text: "Revenue was " },
    { id: "a2", kind: "formula", expression: "SUM(Sales!B:B)", resolved: "$4.2M", state: "fresh" }
  ],
  display: "Revenue was $4.2M",
  marks: [{ id: "m1", from: 12, to: 17, style: ["bold"] }]
};

const formulaBlock = {
  id: "b2",
  type: "formula",
  expression: "=SUM(A1:A10)",
  display: "42",
  value: { kind: "number", value: 42 },
  state: "fresh"
};

const caption = {
  id: "b3cx",
  type: "text",
  variant: "paragraph",
  atoms: [{ id: "b3cx1", kind: "literal", text: "Figure 1" }],
  display: "Figure 1",
  marks: []
};

const imageBlock = {
  id: "b3",
  type: "image",
  source: { kind: "file", fileId: "ef7" },
  display: { fileId: "ef8", width: 1200, height: 675 },
  alt: "Revenue by quarter, rising through Q3",
  caption,
  crop: { x: 0, y: 0, width: 1200, height: 600 }
};

const tableBlock = {
  id: "b4",
  type: "table",
  rows: [
    {
      id: "b4r1",
      cells: [{ id: "b4c1", blocks: [textBlock], columnSpan: 2, format: { verticalAlign: "middle" } }]
    }
  ],
  headerRows: 1,
  columnWidths: [120, 240]
};

const embedBlock = {
  id: "b5",
  type: "embed",
  url: "https://example.com/talk",
  presentation: "card",
  title: "The talk",
  description: "Forty minutes on nothing in particular",
  thumbnail: { fileId: "ef9", width: 320, height: 180 },
  fetchedAt: 1_755_000_000_000
};

const promptBlock = {
  id: "b6",
  type: "prompt",
  derivedOutputId: "derivedOutputs:1",
  atoms: [{ id: "b6x1", kind: "literal", text: "Revenue grew 12% on the quarter." }],
  display: "Revenue grew 12% on the quarter.",
  marks: [{ id: "b6m1", from: 0, to: 7, style: ["bold"] }],
  scope: { op: "kind", kind: "document" },
  state: "fresh",
  refreshedAt: 1_755_000_000_000
};

describe("blockValidator", () => {
  it("carries an id on every variant, which is what a change set addresses", () => {
    for (const member of blockValidator.members) {
      expect(member.fields.id.kind).toBe("string");
    }
  });

  it("discriminates on type, so one field decides which variant a value is", () => {
    expect(blockValidator.members.every((m) => m.fields.type.kind === "literal")).toBe(true);
  });

  it("holds the six variants built so far and no placeholders", () => {
    expect(blockValidator.members.map((m) => m.fields.type.value).sort()).toEqual([
      "embed",
      "formula",
      "image",
      "prompt",
      "table",
      "text"
    ]);
  });

  it("admits every built variant and refuses one that has not been built", () => {
    for (const block of [textBlock, formulaBlock, imageBlock, tableBlock, embedBlock, promptBlock]) {
      expect(validate(blockValidator, block)).toBe(true);
    }
    expect(validate(blockValidator, { id: "b6", type: "diagram", display: "", marks: [] })).toBe(false);
  });

  it("grows a variant without changing an existing one", () => {
    // Each variant owns its whole field set, so growth appends rather than
    // widening — the failure mode this guards is one object with optionals.
    expect(fieldsOf("text").expression).toBeUndefined();
    expect(fieldsOf("formula").atoms).toBeUndefined();
    expect(fieldsOf("image").atoms).toBeUndefined();

    const grown = v.union(
      ...blockValidator.members,
      v.object({ id: v.string(), type: v.literal("diagram"), display: v.string() })
    );
    const textMember = grown.members.find((m) => m.fields.type.value === "text");
    expect(textMember!.fields).toEqual(fieldsOf("text"));
    expect(validate(grown, textBlock)).toBe(true);
  });

  /**
   * Pass 3 appends three members and touches nothing. Pinning the two earlier
   * field sets by name is what makes that checkable — an index would move under
   * a reorder and say nothing about a field quietly added or made optional.
   */
  it("leaves the pass 2 variants' field sets exactly as they were", () => {
    expect(Object.keys(fieldsOf("text")).sort()).toEqual([
      "atoms",
      "checked",
      "display",
      "format",
      "id",
      "language",
      "level",
      "listStyle",
      "marks",
      "resolvedAt",
      "style",
      "type",
      "variant"
    ]);
    expect(Object.keys(fieldsOf("formula")).sort()).toEqual([
      "display",
      "error",
      "expression",
      "format",
      "id",
      "resolvedAt",
      "state",
      "type",
      "value"
    ]);
    expect(fieldsOf("text").display.isOptional).toBe("required");
    expect(fieldsOf("formula").value.isOptional).toBe("required");
  });
});

describe("the text variant", () => {
  it("carries what was authored, what is shown, and the marks over it", () => {
    const fields = fieldsOf("text");
    expect(fields.atoms.kind).toBe("array");
    expect(fields.display.kind).toBe("string");
    expect(fields.marks.kind).toBe("array");
  });

  it("requires display rather than deriving it on read", () => {
    const { display: _display, ...withoutDisplay } = textBlock;
    expect(validate(blockValidator, withoutDisplay)).toBe(false);
  });

  it("names a style by key, leaving the formatting in the resource's style set", () => {
    expect(fieldsOf("text").style).toMatchObject({ kind: "string", isOptional: "optional" });
  });
});

describe("textAtomValidator", () => {
  it("gives every atom an id, which is the finest merge granularity there is", () => {
    for (const member of textAtomValidator.members) {
      expect(member.fields.id.kind).toBe("string");
    }
  });

  it("makes a formula atom carry its own resolved text and state", () => {
    const atom = { id: "a2", kind: "formula", expression: "SUM(B:B)", resolved: "$4.2M", state: "fresh" };
    expect(validate(textAtomValidator, atom)).toBe(true);
    const { resolved: _resolved, ...unresolved } = atom;
    expect(validate(textAtomValidator, unresolved)).toBe(false);
    expect(validate(textAtomValidator, { ...atom, state: "done" })).toBe(false);
  });
});

describe("markValidator", () => {
  it("gives every mark an id, so two people bolding different words merge", () => {
    expect(markValidator.fields.id.kind).toBe("string");
    const { id: _id, ...anonymous } = { id: "m1", from: 0, to: 4 };
    expect(validate(markValidator, anonymous)).toBe(false);
  });

  it("takes a list of styles, so one range can be bold and italic at once", () => {
    expect(validate(markValidator, { id: "m1", from: 0, to: 4, style: ["bold", "italic"] })).toBe(true);
    expect(validate(markValidator, { id: "m1", from: 0, to: 4, style: ["huge"] })).toBe(false);
  });
});

describe("formulaValueValidator", () => {
  it("distinguishes empty from a zero, a blank string, and a false", () => {
    expect(formulaValueValidator.members.map((m) => m.fields.kind.value).sort()).toEqual([
      "boolean",
      "date",
      "empty",
      "number",
      "table",
      "text"
    ]);
  });

  it("admits a table whose cell is itself a table", () => {
    const nested: FormulaValue = {
      kind: "table",
      columns: [{ name: "Region" }],
      rows: [[{ kind: "table", columns: [], rows: [[{ kind: "number", value: 42 }]] }]]
    };
    expect(validate(formulaValueValidator, nested)).toBe(true);
  });

  it("checks the table's own shape, which is the part a validator can reach", () => {
    expect(validate(formulaValueValidator, { kind: "table", rows: [] })).toBe(false);
    expect(validate(formulaValueValidator, { kind: "table", columns: "one", rows: [] })).toBe(false);
    // Rows are rows even though a cell is open.
    expect(validate(formulaValueValidator, { kind: "table", columns: [], rows: "nope" })).toBe(false);
  });

  it("keeps a date's components, because a formula can ask for the month", () => {
    const date = { kind: "date", value: { calendar: "gregorian", year: 2026, month: 8, day: 16, utc: 0 } };
    expect(validate(formulaValueValidator, date)).toBe(true);
    const { utc: _utc, ...componentsOnly } = date.value;
    expect(validate(formulaValueValidator, { kind: "date", value: componentsOnly })).toBe(false);
  });
});

describe("the formula variant", () => {
  it("carries the expression, the resolved display, and the typed value", () => {
    const fields = fieldsOf("formula");
    expect(fields.expression.kind).toBe("string");
    expect(fields.display.kind).toBe("string");
    expect(fields.value.kind).toBe("union");
  });

  it("says a failure in state, never as a value kind", () => {
    expect(validate(blockValidator, { ...formulaBlock, state: "error", error: "#REF!" })).toBe(true);
    expect(validate(formulaValueValidator, { kind: "error", value: "#REF!" })).toBe(false);
  });
});

describe("the image variant", () => {
  it("requires alt, because an image without it is a hole in every non-visual reader", () => {
    const { alt: _alt, ...unlabelled } = imageBlock;
    expect(validate(blockValidator, unlabelled)).toBe(false);
    expect(fieldsOf("image").alt.isOptional).toBe("required");
  });

  it("separates what was given from what we serve, so a placeholder is a missing display", () => {
    const { display: _display, ...unresolved } = imageBlock;
    expect(validate(blockValidator, unresolved)).toBe(true);
    expect(validate(blockValidator, { ...unresolved, source: { kind: "url", url: "https://x/y.png" } })).toBe(true);
    expect(validate(blockValidator, { ...imageBlock, source: { kind: "url", fileId: "ef7" } })).toBe(false);
  });

  it("round-trips through applyOps, caption and all", () => {
    const before = { rows: [{ id: "r1", kind: "blocks", blocks: [] as unknown[] }] };

    const after = applyOps(before, [
      { op: "insert", target: "block", path: "rows/#r1/blocks", after: null, values: [imageBlock] }
    ]);

    expect(after.rows[0].blocks).toEqual([imageBlock]);
    expect(validate(blockValidator, after.rows[0].blocks[0])).toBe(true);
  });

  it("takes an op into its caption, which is an ordinary text block", () => {
    const after = applyOps({ blocks: [imageBlock] }, [
      { op: "text", target: "atom", path: "#b3cx/atoms/#b3cx1", at: 7, insert: "2", remove: "1" },
      { op: "set", target: "block", path: "#b3/alt", value: "Revenue by quarter", was: imageBlock.alt }
    ]);

    expect(after.blocks[0].caption.display).toBe("Figure 2");
    expect(after.blocks[0].alt).toBe("Revenue by quarter");
    expect(validate(blockValidator, after.blocks[0])).toBe(true);
  });
});

describe("the table variant", () => {
  it("holds ContentBlock[] in a cell, not a weaker text-only shape", () => {
    const cell: TableCell = {
      id: "b4c1",
      blocks: [
        { id: "b9", type: "text", variant: "paragraph", atoms: [], display: "", marks: [] },
        { id: "b10", type: "embed", url: "https://example.com", presentation: "inline" }
      ]
    };
    const blocks: ContentBlock[] = cell.blocks;

    expect(validate(blockValidator, { ...tableBlock, rows: [{ id: "b4r1", cells: [cell] }] })).toBe(true);
    for (const block of blocks) expect(validate(blockValidator, block)).toBe(true);
  });

  it("styles per cell, so a renderer has one place to look", () => {
    // The table's own `format` is its own box. There is no second place a cell's
    // styling could come from, which is why a table-wide style is written onto
    // the cells rather than held here.
    expect(Object.keys(fieldsOf("table")).sort()).toEqual([
      "columnWidths",
      "format",
      "headerRows",
      "id",
      "rows",
      "type"
    ]);
    expect(validate(blockValidator, tableBlock)).toBe(true);
    expect(validate(blockValidator, { ...tableBlock, cellFormat: { verticalAlign: "middle" } })).toBe(false);
  });

  it("counts header rows rather than flagging them, so the first two can both be headers", () => {
    expect(fieldsOf("table").headerRows.kind).toBe("float64");
    const { headerRows: _headerRows, ...unheaded } = tableBlock;
    expect(validate(blockValidator, unheaded)).toBe(false);
  });
});

describe("the embed variant", () => {
  it("is block-level, where a plain hyperlink in a sentence is a mark", () => {
    const link = { id: "m9", from: 0, to: 4, link: "https://example.com/talk" };

    expect(validate(markValidator, link)).toBe(true);
    expect(validate(blockValidator, link)).toBe(false);
    expect(validate(blockValidator, embedBlock)).toBe(true);
    expect(validate(markValidator, embedBlock)).toBe(false);
    // Neither is the other spelled differently: an embed has no offsets into a
    // display string, and a mark has no say in how the target is presented.
    expect(fieldsOf("embed").from).toBeUndefined();
    expect(Object.keys(markValidator.fields)).not.toContain("presentation");
  });

  it("caches the fetched display beside the raw url, and says how old it is", () => {
    expect(fieldsOf("embed").url.isOptional).toBe("required");
    for (const field of ["title", "description", "thumbnail", "fetchedAt"]) {
      expect(fieldsOf("embed")[field].isOptional).toBe("optional");
    }
    expect(validate(blockValidator, { id: "b5", type: "embed", url: "https://x", presentation: "card" })).toBe(true);
    expect(validate(blockValidator, { ...embedBlock, presentation: "lightbox" })).toBe(false);
  });
});

describe("the prompt variant", () => {
  it("is a text block with a derived output behind it", () => {
    // The same atoms, display, and marks as any text block, behaving the same
    // way: the text is the user's, editable in place, marked up normally.
    for (const field of ["atoms", "display", "marks"]) {
      expect(fieldsOf("prompt")[field].kind).toBe(fieldsOf("text")[field].kind);
    }
    expect(fieldsOf("prompt").derivedOutputId.isOptional).toBe("required");
  });

  it("stores no prompt of its own", () => {
    // The prompt lives on the derived output. A copy here would be a second
    // prompt that can disagree with the one that produced the text.
    expect(fieldsOf("prompt").prompt).toBeUndefined();
    expect(validate(blockValidator, { ...promptBlock, prompt: "Summarize the findings" })).toBe(
      false
    );
  });

  it("holds one text body, because a derived output produces exactly one block", () => {
    expect(validate(blockValidator, promptBlock)).toBe(true);
    expect(validate(blockValidator, { ...promptBlock, atoms: undefined })).toBe(false);
    expect(validate(blockValidator, { ...promptBlock, blocks: [textBlock] })).toBe(false);
  });

  it("has four states and no idle one, because a block always shows something", () => {
    const states = fieldsOf("prompt").state as unknown as { members: { value: string }[] };
    expect(states.members.map((member) => member.value).sort()).toEqual([
      "error",
      "fresh",
      "generating",
      "stale"
    ]);
    // `idle` is a derived output nothing has been asked of yet, and a block is
    // written into a body by asking.
    expect(validate(blockValidator, { ...promptBlock, state: "idle" })).toBe(false);
  });

  it("carries a scope, because it is part of what the author specified", () => {
    expect(fieldsOf("prompt").scope.isOptional).toBe("optional");
    const { scope: _scope, ...wholeProject } = promptBlock;
    expect(validate(blockValidator, wholeProject)).toBe(true);
    expect(validate(blockValidator, { ...promptBlock, scope: { op: "everything" } })).toBe(false);
  });

  it("takes an edit into its atoms exactly as a text block does", () => {
    const after = applyOps({ blocks: [promptBlock] }, [
      { op: "text", target: "atom", path: "#b6/atoms/#b6x1", at: 14, insert: "4", remove: "2" }
    ]);

    // Editing changes what is displayed and nothing else: the derived output
    // behind it is untouched, and this edited text is what feeds the next
    // refresh as the shape to preserve.
    expect(after.blocks[0].display).toBe("Revenue grew 14% on the quarter.");
    expect(after.blocks[0].derivedOutputId).toBe("derivedOutputs:1");
    expect(validate(blockValidator, after.blocks[0])).toBe(true);
  });

  it("leaves every variant that was already here exactly as it was", () => {
    // The union grows a member; nothing existing changes.
    expect(Object.keys(fieldsOf("image")).sort()).toEqual([
      "alt",
      "caption",
      "crop",
      "display",
      "format",
      "id",
      "source",
      "type"
    ]);
    expect(Object.keys(fieldsOf("embed")).sort()).toEqual([
      "description",
      "fetchedAt",
      "format",
      "id",
      "presentation",
      "thumbnail",
      "title",
      "type",
      "url"
    ]);
    for (const block of [textBlock, formulaBlock, imageBlock, tableBlock, embedBlock]) {
      expect(validate(blockValidator, block)).toBe(true);
    }
  });
});
