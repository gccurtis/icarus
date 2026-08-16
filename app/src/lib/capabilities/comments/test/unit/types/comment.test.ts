import { describe, expect, it } from "vitest";
import { commentsRefusal } from "$comments/errors";
import { commentBody } from "$comments/types/comment";
import type { ContentBlock } from "$content/types/block";

const said = (text: string): ContentBlock => ({
  id: "c1",
  type: "text",
  variant: "paragraph",
  atoms: [{ id: "a1", kind: "literal", text }],
  display: text,
  marks: []
});

const refusalFrom = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return commentsRefusal(error);
  }
};

describe("commentBody", () => {
  it("keeps the blocks it was given", () => {
    const blocks = [said("Needs a source")];

    expect(commentBody(blocks)).toEqual(blocks);
  });

  /** A thread whose first remark says nothing is an anchor nobody can act on. */
  it("refuses a remark with no blocks in it", () => {
    expect(refusalFrom(() => commentBody([]))).toMatchObject({ code: "empty-body" });
  });

  it("refuses a remark whose blocks are all empty", () => {
    const blank: ContentBlock = {
      id: "c1",
      type: "text",
      variant: "paragraph",
      atoms: [],
      display: "",
      marks: []
    };

    expect(refusalFrom(() => commentBody([blank]))).toMatchObject({ code: "empty-body" });
  });

  /** A pasted screenshot with no words is a remark: blocks are not all text. */
  it("admits a remark that is a picture and nothing else", () => {
    const image: ContentBlock = {
      id: "c1",
      type: "image",
      source: { kind: "url", url: "https://example.test/shot.png" },
      alt: "The failing chart"
    };

    expect(commentBody([image])).toEqual([image]);
  });
});
