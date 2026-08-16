import { describe, expect, it } from "vitest";
import { digest128 } from "$knowledge/api/shared/digest";

describe("digest128", () => {
  it("answers the same for the same material", () => {
    expect(digest128("a window of text")).toBe(digest128("a window of text"));
  });

  it("separates material differing by one character", () => {
    expect(digest128("paragraph 1")).not.toBe(digest128("paragraph 2"));
  });

  it("is 128 bits, because a collision hands one artifact another's vector", () => {
    expect(digest128("anything at all")).toMatch(/^[0-9a-f]{32}$/);
  });
});
