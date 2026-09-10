import { describe, expect, it } from "vitest";

import { admitExternalFileRow } from "$representation/data/behavior/external/row";
import { isStoredExternalFile } from "$representation/data/behavior/external/stored-row";

const hash = "a".repeat(64);
const currentRow = () => ({
  _id: "externalFiles:current",
  _creationTime: 100,
  projectId: "projects:current",
  name: "brief.md",
  originalName: "brief.md",
  relativePath: "research/brief.md",
  mediaType: "text/markdown",
  subkind: "text",
  storageId: `_storage:${hash}`,
  hash,
  size: 42,
  origin: { kind: "upload" },
  createdBy: { kind: "user", userId: "users:author" },
  updatedBy: { kind: "user", userId: "users:author" },
  revision: 1,
  updatedAt: 100
});

describe("current External row admission", () => {
  it("admits exactly the strict current schema", () => {
    expect(admitExternalFileRow(currentRow(), 512)).toEqual(currentRow());
    expect(admitExternalFileRow({
      ...currentRow(),
      projectId: "default",
      createdBy: { kind: "user", userId: "default-user" },
      updatedBy: { kind: "user", userId: "default-user" }
    }, 512)).toMatchObject({ projectId: "default" });
    expect(admitExternalFileRow({
      ...currentRow(),
      name: "results.csv",
      originalName: "results.csv",
      relativePath: "research/results.csv",
      mediaType: "text/csv",
      subkind: "data",
      semanticContext: "Quarterly results in USD."
    }, 512)).toMatchObject({ semanticContext: "Quarterly results in USD." });
    expect(isStoredExternalFile(currentRow())).toBe(true);
  });

  it("rejects malformed project and actor identities", () => {
    expect(() => admitExternalFileRow({ ...currentRow(), projectId: " default" }, 512))
      .toThrow(/project id/);
    expect(() => admitExternalFileRow({
      ...currentRow(), createdBy: { kind: "user", userId: "bad\nuser" }
    }, 512)).toThrow(/createdBy actor/);
  });

  it("does not synthesize required fields or accept compatibility fields", () => {
    for (const field of [
      "originalName",
      "relativePath",
      "size",
      "updatedBy",
      "revision"
    ] as const) {
      const candidate: Record<string, unknown> = currentRow();
      delete candidate[field];
      expect(() => admitExternalFileRow(candidate, 512)).toThrow(`missing required field '${field}'`);
    }
    expect(() => admitExternalFileRow({ ...currentRow(), legacyDirectory: "data/materials" }, 512))
      .toThrow(/unexpected field 'legacyDirectory'/);
  });

  it("rejects invalid revision, hash identity, size, media type, and subkind", () => {
    expect(() => admitExternalFileRow({ ...currentRow(), revision: 0 }, 512)).toThrow(/revision/);
    expect(() => admitExternalFileRow({ ...currentRow(), hash: "A".repeat(64) }, 512)).toThrow(/SHA-256/);
    expect(() => admitExternalFileRow({
      ...currentRow(), storageId: `_storage:${"b".repeat(64)}`
    }, 512)).toThrow(/storage id/);
    expect(() => admitExternalFileRow({ ...currentRow(), size: -1 }, 512)).toThrow(/size/);
    expect(() => admitExternalFileRow({
      ...currentRow(), mediaType: "text/plain\r\nx-unsafe: yes"
    }, 512)).toThrow(/media type/);
    expect(() => admitExternalFileRow({ ...currentRow(), subkind: "code" }, 512)).toThrow(/subkind agrees/);
    expect(() => admitExternalFileRow({
      ...currentRow(), semanticContext: "Prose cannot own dataset context."
    }, 512)).toThrow(/only a data file/);
  });

  it("requires a canonical bounded path whose leaf agrees with name", () => {
    expect(() => admitExternalFileRow({
      ...currentRow(), relativePath: "research/other.md"
    }, 512)).toThrow(/path leaf/);
    expect(() => admitExternalFileRow({
      ...currentRow(), relativePath: 42
    }, 512)).toThrow(/relative path is text/);
    expect(() => admitExternalFileRow({
      ...currentRow(), relativePath: `research/${"x".repeat(500)}/brief.md`
    }, 128)).toThrow(/exceeds 128/);
  });
});
