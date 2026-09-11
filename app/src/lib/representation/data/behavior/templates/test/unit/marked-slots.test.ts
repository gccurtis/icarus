import { describe, expect, it } from "vitest";

import {
  slotMarkOver,
  slotNameOver,
  withSlotsAt,
  withMarkedSlots
} from "$representation/data/behavior/templates/prompt-slots";
import type { Atom, Mark } from "$representation/data/types/content/content-block";

/**
 * Marking a run is not an edit.
 *
 * These cases are the foundation the rest of templating stands on: a body may
 * be long, may hold many slots, may be formatted heavily, and none of that is
 * allowed to change until a template is made from a copy of it.
 */

const words = (id: string, text: string): Atom => ({ id, kind: "literal", text });

const mint = () => {
  let at = 0;
  return () => {
    at += 1;
    return `n${at}`;
  };
};

const slot = (id: string, from: [string, number], to: [string, number], name: string): Mark => ({
  id,
  from: { atom: from[0], offset: from[1] },
  to: { atom: to[0], offset: to[1] },
  slot: { name }
});

const style = (id: string, from: [string, number], to: [string, number]): Mark => ({
  id,
  from: { atom: from[0], offset: from[1] },
  to: { atom: to[0], offset: to[1] },
  style: ["bold"]
});

const display = (atoms: readonly Atom[]) =>
  atoms
    .map((atom) =>
      atom.kind === "literal" ? atom.text : atom.kind === "template" ? `{${atom.name}}` : ""
    )
    .join("");

describe("marking a run", () => {
  const atoms = [words("a1", "Dear Northwind, about winter.")];

  it("addresses the run the way every other mark does", () => {
    const mark = slotMarkOver(atoms, 5, 14, "Slot 1", mint());
    expect(mark).toEqual({
      id: "n1",
      from: { atom: "a1", offset: 5 },
      to: { atom: "a1", offset: 14 },
      slot: { name: "Slot 1" }
    });
  });

  it("refuses a caret, a blank name, and an empty block", () => {
    expect(slotMarkOver(atoms, 5, 5, "Slot 1", mint())).toBeUndefined();
    expect(slotMarkOver(atoms, 5, 14, "  ".trim(), mint())).toBeUndefined();
    expect(slotMarkOver([], 0, 3, "Slot 1", mint())).toBeUndefined();
  });

  it("reports a run already covered by a slot, and only when it overlaps", () => {
    const marks = [slot("m1", ["a1", 5], ["a1", 14], "client")];
    expect(slotNameOver(atoms, marks, 6, 9)).toBe("client");
    expect(slotNameOver(atoms, marks, 0, 5)).toBeUndefined();
    expect(slotNameOver(atoms, marks, 14, 20)).toBeUndefined();
  });

  it("reports an existing template atom in a stage as a slot", () => {
    const staged: Atom[] = [
      words("a1", "Dear "),
      { id: "a2", kind: "template", name: "client", text: "Northwind" },
      words("a3", ".")
    ];
    expect(slotNameOver(staged, [], 6, 12)).toBe("client");
    expect(slotNameOver(staged, [], 0, 5)).toBeUndefined();
  });
});

describe("a marked run becoming a slot, on the copy", () => {
  it("keeps the words as what the slot says and leaves the rest of the prose", () => {
    const atoms = [words("a1", "Dear Northwind, about winter.")];
    const held = withSlotsAt(atoms, [slot("m1", ["a1", 5], ["a1", 14], "client")], mint());
    expect(display(held.atoms)).toBe("Dear {client}, about winter.");
    expect(held.atoms[1]).toEqual({ id: "n2", kind: "template", name: "client", text: "Northwind" });
    expect(held.marks).toEqual([]);
  });

  it("keeps a mark that does not reach into the slot, over exactly the same words", () => {
    const atoms = [words("a1", "Dear Northwind, about winter.")];
    const held = withSlotsAt(
      atoms,
      [slot("m1", ["a1", 5], ["a1", 14], "client"), style("m2", ["a1", 22], ["a1", 28])],
      mint()
    );
    const kept = held.marks.find((mark) => mark.id === "m2");
    expect(kept).toBeDefined();
    const segments = held.atoms.map((atom) => display([atom]));
    const flat = segments.join("");
    const at = held.atoms.findIndex((atom) => atom.id === kept?.from.atom);
    const before = segments.slice(0, at).join("").length;
    expect(flat.slice(before + kept!.from.offset, before + kept!.to.offset)).toBe("winter");
  });

  it("drops a mark that reaches into the slot, because those words are a question now", () => {
    const atoms = [words("a1", "Dear Northwind, about winter.")];
    const held = withSlotsAt(
      atoms,
      [slot("m1", ["a1", 5], ["a1", 14], "client"), style("m2", ["a1", 0], ["a1", 9])],
      mint()
    );
    expect(held.marks).toEqual([]);
  });

  it("takes several slots in one block, in order, without disturbing each other", () => {
    const atoms = [words("a1", "Dear Northwind, about winter, from Ana.")];
    const held = withSlotsAt(
      atoms,
      [
        slot("m2", ["a1", 35], ["a1", 38], "sender"),
        slot("m1", ["a1", 5], ["a1", 14], "client")
      ],
      mint()
    );
    expect(display(held.atoms)).toBe("Dear {client}, about winter, from {sender}.");
  });

  it("refuses a second slot that overlaps the first", () => {
    const atoms = [words("a1", "Dear Northwind, about winter.")];
    const held = withSlotsAt(
      atoms,
      [slot("m1", ["a1", 5], ["a1", 14], "client"), slot("m2", ["a1", 10], ["a1", 20], "other")],
      mint()
    );
    expect(display(held.atoms)).toBe("Dear {client}, about winter.");
  });

  it("spans several atoms, taking every literal it covers", () => {
    const atoms = [words("a1", "Dear "), words("a2", "North"), words("a3", "wind, hello.")];
    const held = withSlotsAt(atoms, [slot("m1", ["a1", 5], ["a3", 4], "client")], mint());
    expect(display(held.atoms)).toBe("Dear {client}, hello.");
    expect(held.atoms.find((atom) => atom.kind === "template")).toMatchObject({ text: "Northwind" });
  });

  it("swallows a formula atom that sits inside the run", () => {
    const atoms: Atom[] = [
      words("a1", "Total "),
      {
        id: "a2",
        kind: "formula",
        expression: "SUM(x)",
        lastResolvedDisplay: "42",
        lastResolvedValue: { kind: "empty" },
        state: "fresh"
      },
      words("a3", " today.")
    ];
    const held = withSlotsAt(atoms, [slot("m1", ["a1", 3], ["a3", 3], "figure")], mint());
    expect(display(held.atoms)).toBe("Tot{figure}day.");
    expect(held.atoms.some((atom) => atom.kind === "formula")).toBe(false);
  });

  it("leaves a block with no slot marks exactly as it was", () => {
    const atoms = [words("a1", "Nothing to see.")];
    const marks = [style("m1", ["a1", 0], ["a1", 7])];
    const held = withSlotsAt(atoms, marks, mint());
    expect(held.atoms).toBe(atoms);
    expect(held.marks).toEqual(marks);
  });
});

describe("across a whole body", () => {
  const body = () => ({
    resource: "document",
    rows: [
      {
        id: "r1",
        kind: "blocks",
        blocks: [
          {
            id: "b1",
            type: "text",
            variant: "paragraph",
            atoms: [words("a1", "Dear Northwind.")],
            display: "Dear Northwind.",
            marks: [slot("m1", ["a1", 5], ["a1", 14], "client")]
          },
          {
            id: "b2",
            type: "text",
            variant: "paragraph",
            atoms: [words("b1a", "Nothing here.")],
            display: "Nothing here.",
            marks: []
          }
        ]
      }
    ]
  });

  it("rewrites the marked block, rebuilds its display, and leaves the others alone", () => {
    const held = withMarkedSlots(body(), mint()) as ReturnType<typeof body>;
    const blocks = held.rows[0].blocks as { display: string; marks: unknown[] }[];
    expect(blocks[0].display).toBe("Dear {client}.");
    expect(blocks[0].marks).toEqual([]);
    expect(blocks[1].display).toBe("Nothing here.");
  });

  it("never touches the body it was given", () => {
    const original = body();
    const snapshot = JSON.stringify(original);
    withMarkedSlots(original, mint());
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("carries a hundred slots without losing one", () => {
    const long = {
      resource: "document",
      rows: Array.from({ length: 100 }, (_, index) => ({
        id: `r${index}`,
        kind: "blocks",
        blocks: [
          {
            id: `b${index}`,
            type: "text",
            variant: "paragraph",
            atoms: [words(`a${index}`, `Row ${index} names Northwind here.`)],
            display: `Row ${index} names Northwind here.`,
            marks: [
              slot(`m${index}`, [`a${index}`, `Row ${index} names `.length], [`a${index}`, `Row ${index} names Northwind`.length], `Slot ${index + 1}`)
            ]
          }
        ]
      }))
    };
    const held = withMarkedSlots(long, mint()) as typeof long;
    const displays = held.rows.map((row) => (row.blocks[0] as { display: string }).display);
    expect(displays[0]).toBe("Row 0 names {Slot 1} here.");
    expect(displays[99]).toBe("Row 99 names {Slot 100} here.");
    expect(displays.every((line) => line.includes("{Slot "))).toBe(true);
  });
});
