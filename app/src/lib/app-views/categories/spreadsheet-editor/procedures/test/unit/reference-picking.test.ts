import { describe, expect, it } from "vitest";

import {
  endedReferenceGesture,
  initialReferenceGesture,
  insertedReference,
  startedReferenceGesture
} from "$app-views/categories/spreadsheet-editor/procedures/reference-picking";

describe("references picked while writing a formula", () => {
  it("grows one span from its first cell instead of appending each pointer update", () => {
    const first = insertedReference("=SUM(", "E22", "r22/c5", 1, { from: 5, to: 5 });
    const across = insertedReference(first.text, "E22:F22", "r22/c5", 1, { from: first.caret, to: first.caret }, first.span);
    const down = insertedReference(across.text, "E22:F23", "r22/c5", 1, { from: across.caret, to: across.caret }, across.span);

    expect(first.text).toBe("=SUM(E22");
    expect(across.text).toBe("=SUM(E22:F22");
    expect(down).toEqual({
      text: "=SUM(E22:F23",
      span: { from: 5, to: 12, anchor: "r22/c5", gesture: 1 },
      caret: 12
    });
  });

  it("starts another span when the reader picks from a different cell", () => {
    const first = insertedReference("=E22+", "F22", "r22/c6", 1, { from: 5, to: 5 });
    const second = insertedReference(first.text, "G22", "r22/c7", 2, { from: first.caret, to: first.caret }, first.span);

    expect(second.text).toBe("=E22+F22G22");
    expect(second.span.anchor).toBe("r22/c7");
  });

  it("starts at the live text selection when a later gesture uses the same anchor", () => {
    const first = insertedReference("=C1+D1", "A1", "r1/c1", 1, { from: 1, to: 3 });
    const second = insertedReference(first.text, "A1:B1", "r1/c1", 2, { from: 4, to: 6 }, first.span);

    expect(first.text).toBe("=A1+D1");
    expect(second.text).toBe("=A1+A1:B1");
    expect(second.span).toEqual({ from: 4, to: 9, anchor: "r1/c1", gesture: 2 });
  });

  it("gives every pointer gesture one monotonic identity", () => {
    const first = startedReferenceGesture(initialReferenceGesture());
    const resting = endedReferenceGesture(first);
    const second = startedReferenceGesture(resting);

    expect(first).toEqual({ serial: 1, active: 1 });
    expect(resting).toEqual({ serial: 1 });
    expect(second).toEqual({ serial: 2, active: 2 });
  });
});
