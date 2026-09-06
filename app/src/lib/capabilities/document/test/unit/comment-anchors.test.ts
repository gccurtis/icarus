import { describe, expect, it } from "vitest";

import { transformCommentAnchor } from "$capabilities/document/api/submit-document-changes/transform-comment-anchor";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";

const first = {
  blockId: "#b1",
  from: { atom: "#a1", offset: 3 },
  to: { atom: "#a1", offset: 8 }
};

const body = (text: string): DocumentBody => ({
  rows: [
    {
      id: "#r1",
      kind: "blocks",
      blocks: [
        {
          id: "#b1",
          type: "text",
          variant: "paragraph",
          atoms: [{ id: "#a1", kind: "literal", text }],
          display: text,
          marks: []
        }
      ]
    }
  ]
});

const splice = (at: number, insert: string, remove: string): DocumentOp => ({
  op: "text",
  target: "atom",
  path: "#b1/atoms/#a1",
  at,
  insert,
  remove
});

describe("document comment anchors", () => {
  it("keeps the cited text selected when typing before or inside it", () => {
    expect(transformCommentAnchor({ kind: "text", ...first }, [splice(0, "++", "")], body("++abcdefghij"))).toEqual({
      kind: "text",
      spans: [{ ...first, from: { atom: "#a1", offset: 5 }, to: { atom: "#a1", offset: 10 } }]
    });

    expect(transformCommentAnchor({ kind: "text", ...first }, [splice(5, "++", "")], body("abcde++fghij"))).toEqual({
      kind: "text",
      spans: [{ ...first, to: { atom: "#a1", offset: 10 } }]
    });
  });

  it("contracts deletion to a stable collapsed anchor", () => {
    expect(transformCommentAnchor({ kind: "text", ...first }, [splice(3, "", "defgh")], body("abcij"))).toEqual({
      kind: "text",
      spans: [{ ...first, from: { atom: "#a1", offset: 3 }, to: { atom: "#a1", offset: 3 } }]
    });
  });

  it("detaches a span when its block no longer exists", () => {
    expect(transformCommentAnchor({ kind: "text", ...first }, [], { rows: [] })).toEqual({
      kind: "text",
      spans: []
    });
  });
});
