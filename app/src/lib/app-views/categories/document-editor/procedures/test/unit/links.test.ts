import { describe, expect, it } from "vitest";

import {
  normalizeLinkUrl,
  safeLinkHref,
  wordAt
} from "$app-views/categories/document-editor/procedures/links";

describe("document links", () => {
  it("normalizes a hostname and preserves an explicit safe scheme", () => {
    expect(normalizeLinkUrl("example.com/source")).toEqual({
      ok: true,
      url: "https://example.com/source"
    });
    expect(normalizeLinkUrl("mailto:editor@example.com")).toEqual({
      ok: true,
      url: "mailto:editor@example.com"
    });
  });

  it("rejects executable and malformed schemes", () => {
    expect(normalizeLinkUrl("javascript:alert(1)")).toEqual({
      ok: false,
      reason: "Use an http, https, mailto, or tel link."
    });
    expect(safeLinkHref({ kind: "url", url: "javascript:alert(1)" })).toBeUndefined();
  });

  it("keeps notes out of URL normalization", () => {
    expect(
      safeLinkHref({ kind: "url", url: "https://example.com/a", note: "Source rationale" })
    ).toBe("https://example.com/a");
  });

  it("selects deterministic word boundaries at either side of a browser hit", () => {
    expect(wordAt("Winter readiness brief", 2)).toEqual({ from: 0, to: 6 });
    expect(wordAt("Winter readiness brief", 6)).toEqual({ from: 0, to: 6 });
    expect(wordAt("don't split", 3)).toEqual({ from: 0, to: 5 });
    expect(wordAt("Winter readiness brief", 7)).toEqual({ from: 7, to: 16 });
    expect(wordAt("Winter readiness brief", 22)).toEqual({ from: 17, to: 22 });
  });
});
