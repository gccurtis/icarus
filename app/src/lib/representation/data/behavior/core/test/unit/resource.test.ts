import { describe, expect, it } from "vitest";

import {
  admitResourceRef,
  externalFileResourceKind,
  isExternalFileResourceKind,
  isExternalFileSubkind,
  isResourceKind,
  isResourceRef,
  isResourceSelectorKind,
  kindMatches
} from "$representation/data/behavior/core/resource";

describe("current resource identity", () => {
  it("closes exact reference kinds and keeps the external family selector separate", () => {
    expect(isResourceKind("document")).toBe(true);
    expect(isResourceKind("externalFile::audio")).toBe(true);
    expect(isResourceKind("externalFile")).toBe(false);
    expect(isResourceSelectorKind("externalFile")).toBe(true);
    expect(kindMatches("externalFile", "externalFile::video")).toBe(true);
    expect(isExternalFileSubkind("video")).toBe(true);
    expect(isExternalFileSubkind("pdf")).toBe(false);
    expect(isExternalFileResourceKind("externalFile::video")).toBe(true);
    expect(isExternalFileResourceKind("externalFile::pdf")).toBe(false);
    expect(() => externalFileResourceKind("pdf" as never)).toThrow(/not current/);
  });

  it.each([
    ["document", "documents:one"],
    ["slides", "slideDecks:one"],
    ["spreadsheet", "spreadsheets:one"],
    ["research", "researchThreads:one"],
    ["finding", "findings:one"],
    ["connection", "connectors:one"],
    ["externalFile::text", "externalFiles:one"],
    ["externalFile::data", "externalFiles:one"],
    ["externalFile::image", "externalFiles:one"],
    ["externalFile::audio", "externalFiles:one"],
    ["externalFile::video", "externalFiles:one"],
    ["externalFile::unknown", "externalFiles:one"]
  ])("admits %s with its represented namespace", (kind, id) => {
    expect(isResourceRef({ kind, id })).toBe(true);
  });

  it.each([
    { kind: "analysis", id: "analyses:one" },
    { kind: "externalFile", id: "externalFiles:one" },
    { kind: "externalFile::pdf", id: "externalFiles:one" },
    { kind: "document", id: "slideDecks:one" },
    { kind: "connection", id: "connections:one" },
    { kind: "document", id: "documents:one", retired: true }
  ])("rejects a non-current or incoherent ref %#", (ref) => {
    expect(isResourceRef(ref)).toBe(false);
    expect(() => admitResourceRef(ref)).toThrow(/current resource kind/);
  });

  it("requires the two represented fields to be own fields", () => {
    const inherited = Object.assign(Object.create({ kind: "document" }), {
      id: "documents:one",
      retired: true
    });
    expect(isResourceRef(inherited)).toBe(false);
    expect(isResourceRef({
      kind: { toString: () => "document" },
      id: "documents:one"
    })).toBe(false);
  });
});
