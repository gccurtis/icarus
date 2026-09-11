import { describe, expect, it } from "vitest";

import { matchingExternalHistory } from "$app-views/categories/external/procedures/history-query";
import {
  relativeTime,
  type LibraryExternalHistoryEntry
} from "$app-views/categories/external/procedures/library-query";

const entries: readonly LibraryExternalHistoryEntry[] = [
  {
    id: "activity:context", externalFileId: "externalFiles:revenue",
    event: "context-updated", name: "Revenue.csv", relativePath: "finance/Revenue.csv",
    actorId: "users:morgan", actorName: "Morgan Lee", detail: "Amounts are in USD", at: 200, when: "1m"
  },
  {
    id: "activity:upload", externalFileId: "externalFiles:brief",
    event: "uploaded", name: "Brief.md", relativePath: "research/Brief.md",
    actorId: "users:sam", actorName: "Sam Rivera", at: 100, when: "2m"
  }
];

describe("External Files recent history search", () => {
  it("matches displayed event, filename, path, actor, and optional detail", () => {
    for (const search of ["updated context", "revenue.CSV", "finance/", "MORGAN LEE", "USD"]) {
      expect(matchingExternalHistory(entries, search), search).toEqual([entries[0]]);
    }
    expect(matchingExternalHistory(entries, "uploaded")).toEqual([entries[1]]);
  });

  it("requires every query term even when they occur in different fields", () => {
    expect(matchingExternalHistory(entries, "  USD\tMorgan  ")).toEqual([entries[0]]);
    expect(matchingExternalHistory(entries, "revenue Rivera")).toEqual([]);
    expect(matchingExternalHistory([], "revenue")).toEqual([]);
  });

  it("restores the supplied recent entries in their original order for a blank query", () => {
    expect(matchingExternalHistory(entries, "  \n\t ")).toBe(entries);
    expect(matchingExternalHistory(entries, "")).toBe(entries);
  });
});

describe("External Files compact history time", () => {
  const now = Date.UTC(2026, 8, 11, 12);

  it.each([
    [20_000, "now"],
    [48.6 * 60_000, "49m"],
    [9.2 * 60 * 60_000, "9h"],
    [1.1 * 24 * 60 * 60_000, "1d"],
    [12.4 * 24 * 60 * 60_000, "12d"]
  ])("contracts a %dms-old event to %s", (age, expected) => {
    expect(relativeTime(now - age, now)).toBe(expected);
  });
});
