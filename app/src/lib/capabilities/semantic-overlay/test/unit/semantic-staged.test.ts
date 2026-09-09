import { describe, expect, it } from "vitest";

import { isStagedResource } from "$capabilities/semantic-overlay/api/shared/staged";
import type { StoreModel } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";

/**
 * A template's working copy is not the project's material.
 *
 * Every path into the overlay asks this one question, so the answer has to hold
 * for the ordinary save, for a backfill, and for a resource that merely shares
 * an id with something in another project.
 */

const storeOf = (rows: readonly Record<string, unknown>[]): StoreModel =>
  ({
    read: (table: string) =>
      table === "templateStages" ? { table, kind: "table", rows } : undefined
  }) as unknown as StoreModel;

const project = "projects:1" as Id<"projects">;

const stage = (projectId: string, resourceId: string) => ({
  _id: `templateStages:${resourceId}`,
  projectId,
  resourceId
});

describe("what the overlay refuses", () => {
  it("refuses a document and a deck that a template is being edited in", () => {
    const store = storeOf([stage(project, "documents:1"), stage(project, "slideDecks:2")]);
    expect(isStagedResource(store, project, { kind: "document", id: "documents:1" })).toBe(true);
    expect(isStagedResource(store, project, { kind: "slides", id: "slideDecks:2" })).toBe(true);
  });

  it("takes an ordinary resource, and one staged in another project", () => {
    const store = storeOf([stage(project, "documents:1"), stage("projects:9", "documents:7")]);
    expect(isStagedResource(store, project, { kind: "document", id: "documents:4" })).toBe(false);
    expect(isStagedResource(store, project, { kind: "document", id: "documents:7" })).toBe(false);
  });

  it("says nothing about kinds a stage cannot be", () => {
    const store = storeOf([stage(project, "documents:1")]);
    expect(isStagedResource(store, project, { kind: "spreadsheet", id: "documents:1" })).toBe(false);
    expect(isStagedResource(store, project, { kind: "externalFile::text", id: "documents:1" })).toBe(false);
  });

  it("takes everything when nothing is staged at all", () => {
    const store = storeOf([]);
    expect(isStagedResource(store, project, { kind: "document", id: "documents:1" })).toBe(false);
  });
});
