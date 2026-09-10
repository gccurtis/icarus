import { describe, expect, it } from "vitest";

import {
  externalCodeLanguage,
  externalFileNameIn,
  externalPathSetHasConflicts,
  externalPathsConflict,
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
    expect(() => normalizeExternalRelativePath("folder/bad\nname.md")).toThrow(/control/);
  });

  it("keeps virtual file and directory identities mutually exclusive", () => {
    expect(externalPathsConflict("reports", "reports")).toBe(true);
    expect(externalPathsConflict("reports", "reports/q1.csv")).toBe(true);
    expect(externalPathsConflict("reports/q1.csv", "reports")).toBe(true);
    expect(externalPathsConflict("reports", "reports-archive/q1.csv")).toBe(false);
    expect(externalPathsConflict("reports/q1.csv", "reports/q2.csv")).toBe(false);
    expect(externalPathSetHasConflicts([
      "reports/q2.csv",
      "reports-archive/q1.csv",
      "reports"
    ])).toBe(true);
    expect(externalPathSetHasConflicts([
      "reports/q2.csv",
      "reports-archive/q1.csv",
      "reports/q1.csv"
    ])).toBe(false);
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
    expect(fileSubkindFor("text/markdown", "notes.md")).toBe("text");
    expect(fileSubkindFor("text/plain", "README")).toBe("text");
    expect(externalCodeLanguage("notes.md", "text/markdown")).toBe("unknown");
    expect(externalCodeLanguage("README", "text/plain")).toBe("unknown");
    expect(fileSubkindFor("application/pdf", "brief.pdf")).toBe("unknown");
  });

  it("canonicalizes recognized text extensions before arbitrary browser MIME hints", () => {
    expect(mediaTypeForExternalBytes(
      new TextEncoder().encode("export const answer = 42"),
      "text/vnd.trolltech.linguist",
      "answer.ts"
    )).toBe("text/typescript");
    expect(mediaTypeForExternalBytes(
      new TextEncoder().encode("region\tvalue"),
      "application/octet-stream",
      "data.tsv"
    )).toBe("text/tab-separated-values");
    const signedPdf = mediaTypeForExternalBytes(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
      "text/markdown",
      "misleading.md"
    );
    expect(signedPdf).toBe("application/pdf");
    expect(fileSubkindFor(signedPdf, "misleading.md")).toBe("unknown");
  });
});
