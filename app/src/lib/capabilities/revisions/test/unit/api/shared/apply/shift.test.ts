import { describe, expect, it } from "vitest";
import { CONFLICT, shift, type TextSpan } from "$revisions/api/shared/apply/shift";

/**
 * Every row of the case table gets its own assertion, because this is the one
 * function in the system that fails open: everything else rejects when in doubt
 * and costs someone a resubmit, while a wrong answer here puts characters in the
 * wrong order with nothing raised and nothing to notice.
 */

/** A window applied in revision order, each op against the result of the last. */
const through = (p: number, window: TextSpan[]): number | typeof CONFLICT => {
  let at: number | typeof CONFLICT = p;
  for (const a of window) {
    if (at === CONFLICT) return CONFLICT;
    at = shift(at, a);
  }
  return at;
};

const bolded: TextSpan = { at: 4, remove: "", insert: "strong " };
const replaced: TextSpan = { at: 4, remove: "quarterly", insert: "Q3" };

describe("shift", () => {
  it("moves an offset after the replaced range by the length delta", () => {
    expect(shift(20, bolded)).toBe(27);
  });

  it("leaves an offset before the replaced range where it was", () => {
    expect(shift(2, bolded)).toBe(2);
  });

  it("conflicts on an offset strictly inside the replaced range", () => {
    expect(shift(6, replaced)).toBe(CONFLICT);
  });

  it("sends the later of two inserts at one point after the committed one", () => {
    expect(shift(4, { at: 4, remove: "", insert: "x" })).toBe(5);
  });

  it("grows a mark spanning the edit, so typed-into bold stays bold", () => {
    expect(shift(0, { at: 4, remove: "", insert: "xx" })).toBe(0);
    expect(shift(30, { at: 4, remove: "", insert: "xx" })).toBe(32);
  });

  it("pins both ends of a mark spanning a replacement", () => {
    expect(shift(4, replaced)).toBe(4);
    expect(shift(13, replaced)).toBe(6);
  });

  it("conflicts on both ends of a mark contained in the replacement", () => {
    expect(shift(5, replaced)).toBe(CONFLICT);
    expect(shift(12, replaced)).toBe(CONFLICT);
  });

  it("accumulates a window in revision order", () => {
    expect(through(20, [bolded, { at: 0, remove: "", insert: "# " }])).toBe(29);
  });

  it("conflicts once, whatever follows in the window", () => {
    expect(through(6, [replaced, bolded])).toBe(CONFLICT);
  });

  it("counts UTF-16 code units, so an astral character moves an offset by two", () => {
    expect(shift(10, { at: 4, remove: "", insert: "😀" })).toBe(12);
    expect(shift(10, { at: 4, remove: "😀", insert: "" })).toBe(8);
  });

  it("conflicts between the halves of a removed surrogate pair", () => {
    expect(shift(5, { at: 4, remove: "😀", insert: "" })).toBe(CONFLICT);
  });
});
