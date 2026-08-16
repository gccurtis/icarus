import { describe, expect, it } from "vitest";
import { externalFilesTables } from "$external-files/schema";

describe("externalFiles schema", () => {
  it("leads every index with projectId", () => {
    const indexes = externalFilesTables.externalFiles[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  /**
   * The connector's own id and the provider's id for the file, in that order, is
   * what a re-sync matches on — without it a changed remote file becomes a
   * duplicate row rather than a new version of the one we already have.
   */
  it("matches a re-synced file on its connector and the provider's own id", () => {
    const indexes = externalFilesTables.externalFiles[" indexes"]();
    const match = indexes.find((index) => index.indexDescriptor === "by_connector_external");

    expect(match?.fields).toEqual(["projectId", "origin.connectorId", "origin.externalId"]);
  });

  it("holds what a file is, where its bytes came from, and what we read out of it", () => {
    const fields = Object.keys(externalFilesTables.externalFiles.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "storageId",
        "name",
        "extension",
        "mimeType",
        "size",
        "kind",
        "origin",
        "supersedes",
        "extraction",
        "createdBy",
        "updatedAt"
      ].sort()
    );
  });

  /**
   * Bytes are immutable, so a new version is a new row. A `revision` here would
   * invite the opposite — rewriting a file under references made to its
   * contents.
   */
  it("keeps a revision off the row, because a new version is a new file", () => {
    const fields = externalFilesTables.externalFiles.validator.fields;

    expect(fields).not.toHaveProperty("revision");
    expect(fields).not.toHaveProperty("supersededBy");
  });
});
