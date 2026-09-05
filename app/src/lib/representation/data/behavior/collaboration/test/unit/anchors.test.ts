import { describe, expect, it } from "vitest";

import {
  canonicalAnchorWithin,
  textAnchorSpans
} from "$representation/data/behavior/collaboration/anchors";

const first = {
  blockId: "#b1",
  from: { atom: "#a1", offset: 3 },
  to: { atom: "#a1", offset: 8 }
};

describe("text comment anchors", () => {
  it("reads the legacy single-block representation", () => {
    expect(textAnchorSpans({ kind: "text", ...first })).toEqual([first]);
    expect(canonicalAnchorWithin({ kind: "text", ...first })).toEqual({
      kind: "text",
      spans: [first]
    });
  });

  it("preserves every span in the canonical cross-block representation", () => {
    const second = {
      blockId: "#b2",
      from: { atom: "#a2", offset: 0 },
      to: { atom: "#a2", offset: 4 }
    };
    const anchor = { kind: "text" as const, spans: [first, second] };

    expect(textAnchorSpans(anchor)).toEqual([first, second]);
    expect(canonicalAnchorWithin(anchor)).toEqual(anchor);
  });

  it("drops malformed spans instead of handing unsafe offsets to an editor", () => {
    expect(
      textAnchorSpans({
        kind: "text",
        spans: [first, { blockId: "#b2", from: { atom: "#a2", offset: -1 }, to: { atom: "#a2", offset: 2 } }]
      })
    ).toEqual([first]);
  });
});
