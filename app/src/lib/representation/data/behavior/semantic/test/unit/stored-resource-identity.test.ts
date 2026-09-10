import { describe, expect, it } from "vitest";

import { isStoredMaterialSource } from "$representation/data/behavior/semantic/stored-citations";

const source = {
  kind: "externalFile",
  ref: { kind: "externalFile::image", id: "externalFiles:logo" },
  fileId: "externalFiles:logo",
  hash: "a".repeat(64),
  mediaType: "image/png",
  subkind: "image"
};

describe("stored semantic resource identity", () => {
  it("requires one exact external-file ref, file row, and subkind identity", () => {
    expect(isStoredMaterialSource(source)).toBe(true);
    expect(isStoredMaterialSource({
      ...source,
      ref: { kind: "externalFile", id: "externalFiles:logo" }
    })).toBe(false);
    expect(isStoredMaterialSource({
      ...source,
      ref: { kind: "externalFile::pdf", id: "externalFiles:logo" }
    })).toBe(false);
    expect(isStoredMaterialSource({
      ...source,
      ref: { kind: "externalFile::text", id: "externalFiles:logo" }
    })).toBe(false);
    expect(isStoredMaterialSource({
      ...source,
      ref: { kind: "externalFile::image", id: "externalFiles:other" }
    })).toBe(false);
    expect(isStoredMaterialSource({ ...source, retired: true })).toBe(false);
  });
});
