import { describe, expect, it } from "vitest";
import { notFound, RevisionsError } from "$revisions/errors";
import { RESOURCE } from "$revisions/test/fixture";

/**
 * The payload, never the message: it is the only part Convex serializes, so what
 * a client can branch on is exactly what is asserted here.
 */
describe("RevisionsError", () => {
  it("names the rung that refused, when a rung refused", () => {
    expect(new RevisionsError("touched-intersects", "collision", 2).data).toEqual({
      capability: "revisions",
      code: "touched-intersects",
      message: "collision",
      step: 2
    });
  });

  it("omits the step entirely for a refusal outside the ladder", () => {
    // Present-but-undefined is not absent: a client testing `"step" in refusal`
    // reads a rung that never ran, and the value survives the wire as whatever
    // the serializer makes of `undefined`.
    expect(Object.keys(notFound(RESOURCE).data).sort()).toEqual([
      "capability",
      "code",
      "message"
    ]);
  });
});
