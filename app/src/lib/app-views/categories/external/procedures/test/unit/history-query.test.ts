import { describe, expect, it } from "vitest";

import { matchingExternalHistory } from "$app-views/categories/external/procedures/history-query";
import type { LibraryExternalHistoryEntry } from "$app-views/categories/external/procedures/library-query";

const entries: readonly LibraryExternalHistoryEntry[] = [
  {
    id: "activity:context", externalFileId: "externalFiles:revenue",
    event: "context-updated", name: "Revenue.csv", relativePath: "finance/Revenue.csv",
    actorName: "Morgan Lee", detail: "Amounts are in USD", at: 200, when: "1m ago"
  },
  {
    id: "activity:upload", externalFileId: "externalFiles:brief",
    event: "uploaded", name: "Brief.md", relativePath: "research/Brief.md",
    actorName: "Sam Rivera", at: 100, when: "2m ago"
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
