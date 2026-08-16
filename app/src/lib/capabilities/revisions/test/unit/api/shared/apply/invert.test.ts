import { describe, expect, it } from "vitest";
import { applyOps } from "$revisions/api/shared/apply/apply";
import { invert } from "$revisions/api/shared/apply/invert";
import type { Op } from "$revisions/types/change";

/**
 * Undo is an ordinary change set, so the op set has to be closed under
 * inversion. What each op carries beyond its effect — `was`, `values`, `after`,
 * `wasAfter` — exists only to make its inverse constructible without replaying
 * from the head.
 */

const set: Op = {
  op: "set",
  target: "mark",
  path: "#b7x2/marks/#m03",
  value: { id: "m03", from: 4, to: 9, style: ["bold"] },
  was: { id: "m03", from: 4, to: 9 }
};

const insert: Op = {
  op: "insert",
  target: "row",
  path: "rows",
  after: "r4m1",
  values: [{ id: "r9k2" }, { id: "r9k3" }]
};

const remove: Op = {
  op: "remove",
  target: "row",
  path: "rows",
  ids: ["r9k2"],
  after: "r4m1",
  values: [{ id: "r9k2" }]
};

const move: Op = {
  op: "move",
  target: "slide",
  path: "slides",
  id: "s12",
  after: "s03",
  wasAfter: null
};

const text: Op = {
  op: "text",
  target: "atom",
  path: "#b7x2/atoms/#a9x1",
  at: 4,
  insert: "strong ",
  remove: ""
};

describe("invert", () => {
  it("swaps a set's value and what it replaced", () => {
    expect(invert(set)).toEqual({ ...set, value: set.was, was: set.value });
  });

  it("turns an insert into a remove of the same values from the same place", () => {
    expect(invert(insert)).toEqual({
      op: "remove",
      target: "row",
      path: "rows",
      ids: ["r9k2", "r9k3"],
      after: "r4m1",
      values: insert.values
    });
  });

  it("turns a remove into an insert that puts the values back where they were", () => {
    expect(invert(remove)).toEqual({
      op: "insert",
      target: "row",
      path: "rows",
      after: "r4m1",
      values: remove.values
    });
  });

  it("swaps a move's destination and its origin", () => {
    expect(invert(move)).toEqual({ ...move, after: null, wasAfter: "s03" });
  });

  it("swaps a text op's inserted and removed strings", () => {
    expect(invert(text)).toEqual({ ...text, insert: "", remove: "strong " });
  });

  it("returns the original op when applied twice, for all five", () => {
    for (const op of [set, insert, remove, move, text]) {
      expect(invert(invert(op))).toEqual(op);
    }
  });

  it("takes a bare value as its own id, because a merge range carries none", () => {
    const merges: Op = {
      op: "insert",
      target: "merge",
      path: "sheets/#sh1/merges",
      after: null,
      values: ["B2:D4"]
    };

    expect(invert(merges)).toEqual({ ...merges, op: "remove", ids: ["B2:D4"] });
  });

  it("names a keyed entry by its path, because it has no identity of its own", () => {
    // A spreadsheet cell. Its address *is* what it is called, so the path is the
    // only thing that could name it — and the undo of creating one has to be
    // able to.
    const cell: Op = {
      op: "insert",
      target: "cell",
      path: "sheets/#sh1/cells/B7",
      after: null,
      values: [{ blocks: [] }]
    };

    expect(invert(cell)).toEqual({ ...cell, op: "remove", ids: ["B7"] });
  });

  it("refuses to undo an insert of a value it cannot name, rather than removing nothing", () => {
    const nameless: Op = {
      op: "insert",
      target: "block",
      path: "#r4m1/blocks",
      after: null,
      values: [{ type: "text" }]
    };

    // The fallback names the list rather than an entry in it, so the undo is
    // refused where it is carried out. What must never happen is a remove that
    // silently takes nothing.
    expect(() =>
      applyOps({ rows: [{ id: "r4m1", blocks: [{ id: "b1" }] }] }, [invert(nameless)])
    ).toThrow();
  });
});
