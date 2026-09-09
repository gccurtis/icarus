import { describe, expect, it } from "vitest";

import {
  externalFileNameIn,
  fileSubkindFor,
  mediaTypeForExternalBytes,
  normalizeExternalRelativePath
} from "$representation/data/behavior/external/file";

describe("external file admission", () => {
  it("normalizes browser folder separators without producing a server path", () => {
    expect(normalizeExternalRelativePath("research\\north\\notes.md")).toBe("research/north/notes.md");
    expect(externalFileNameIn("research/north/notes.md")).toBe("notes.md");
    expect(() => normalizeExternalRelativePath("../notes.md")).toThrow(/traversal/);
    expect(() => normalizeExternalRelativePath("/tmp/notes.md")).toThrow(/relative/);
    expect(() => normalizeExternalRelativePath("C:\\notes.md")).toThrow(/relative/);
    expect(() => normalizeExternalRelativePath("folder//notes.md")).toThrow(/empty/);
  });

  it("reconciles common signatures and keeps unknown bytes safely generic", () => {
    expect(
      mediaTypeForExternalBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "", "wrong.bin"),
    ).toBe("image/png");
    expect(
      mediaTypeForExternalBytes(new TextEncoder().encode("a,b\n1,2"), "", "facts.csv"),
    ).toBe("text/csv");
    expect(
      mediaTypeForExternalBytes(
        new TextEncoder().encode("safe"),
        "text/plain\r\nx-injected: yes",
        "notes.txt"
      ),
    ).toBe("text/plain");
    expect(fileSubkindFor("text/csv", "facts.csv")).toBe("data");
    expect(fileSubkindFor("application/pdf", "brief.pdf")).toBe("unknown");
  });
});
