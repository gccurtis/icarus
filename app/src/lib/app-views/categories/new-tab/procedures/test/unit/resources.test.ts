import { describe, expect, it } from "vitest";

import {
  ageOf,
  recentsOf,
  resourcesOf
} from "$app-views/categories/new-tab/procedures/resources";
import { openingFor } from "$app-views/categories/new-tab/procedures/opening";
import type { ProjectResourceIndex } from "$capabilities/project-resources/index.remote";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 8, 7, 16);

const index: ProjectResourceIndex = {
  resources: [
    {
      id: "documents:older",
      kind: "document",
      name: "Older memo",
      updatedAt: NOW - 2 * DAY,
      updatedByName: "Ana"
    },
    {
      id: "slideDecks:newer",
      kind: "slides",
      name: "Newest deck",
      updatedAt: NOW - MINUTE,
      updatedByName: "Mira"
    },
    {
      id: "documents:middle",
      kind: "document",
      name: "Middle memo",
      updatedAt: NOW - HOUR,
      updatedByName: "Tomas"
    }
  ],
  unavailable: []
};

describe("New tab represented resources", () => {
  it("keeps the canonical ids that destination editors resolve", () => {
    expect(resourcesOf(index, NOW)).toEqual([
      {
        id: "documents:older",
        kind: "document",
        name: "Older memo",
        updatedAt: NOW - 2 * DAY,
        updated: "2 days ago",
        updatedBy: "Ana"
      },
      {
        id: "slideDecks:newer",
        kind: "slides",
        name: "Newest deck",
        updatedAt: NOW - MINUTE,
        updated: "1 minute ago",
        updatedBy: "Mira"
      },
      {
        id: "documents:middle",
        kind: "document",
        name: "Middle memo",
        updatedAt: NOW - HOUR,
        updated: "1 hour ago",
        updatedBy: "Tomas"
      }
    ]);
    expect(resourcesOf(undefined, NOW)).toEqual([]);
  });

  it("sorts the Recent shelf by represented update time and bounds its size", () => {
    const recent = recentsOf(index, NOW, 2);

    expect(recent.map((row) => row.id)).toEqual([
      "slideDecks:newer",
      "documents:middle"
    ]);
    expect(recent[0]).toMatchObject({
      updated: "1 minute ago",
      updatedBy: "Mira"
    });
    expect(index.resources.map((row) => row.id)).toEqual([
      "documents:older",
      "slideDecks:newer",
      "documents:middle"
    ]);
  });

  it("collapses manager-only files in Recent while keeping every file searchable", () => {
    const withFiles: ProjectResourceIndex = {
      resources: [
        ...index.resources,
        { id: "externalFiles:a", kind: "file", name: "a.txt", updatedAt: NOW, updatedByName: "Ana" },
        { id: "externalFiles:b", kind: "file", name: "b.txt", updatedAt: NOW - 1, updatedByName: "Ana" }
      ],
      unavailable: []
    };

    expect(resourcesOf(withFiles, NOW).filter((row) => row.kind === "file")).toHaveLength(2);
    expect(recentsOf(withFiles, NOW).filter((row) => row.kind === "file")).toEqual([
      expect.objectContaining({ id: "externalFiles:a" })
    ]);
    expect(openingFor("file", "externalFiles:a")).toEqual({
      category: "external",
      focus: "externalFiles:a"
    });
  });

  it("phrases timestamps across the launcher's compact ranges", () => {
    expect(ageOf(NOW, NOW)).toBe("just now");
    expect(ageOf(NOW - 3 * MINUTE, NOW)).toBe("3 minutes ago");
    expect(ageOf(NOW - 4 * HOUR, NOW)).toBe("4 hours ago");
    expect(ageOf(NOW - DAY, NOW)).toBe("Yesterday");
    expect(ageOf(NOW - 6 * DAY, NOW)).toBe("6 days ago");
  });
});
