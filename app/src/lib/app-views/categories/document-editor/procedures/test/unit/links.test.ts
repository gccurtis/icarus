import { describe, expect, it } from "vitest";

import {
  normalizeLinkUrl,
  safeLinkHref
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
});
