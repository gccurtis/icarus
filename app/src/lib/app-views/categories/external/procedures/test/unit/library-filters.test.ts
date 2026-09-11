import { describe, expect, it } from "vitest";
import { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import { clearLibraryFilters } from "$app-views/categories/external/procedures/clear-library-filters";
import { externalAuthors, libraryFiltersActive, visibleExternalFiles } from "$app-views/categories/external/procedures/library-view";
import {
  semanticPresentation,
  type LibraryExternalFile
} from "$app-views/categories/external/procedures/library-query";
import { updatedTime } from "$app-views/categories/external/procedures/updated-time";
import type { Id } from "$representation/data/types/core/id";

const file = (id: string, path: string, author: string, updatedAt: number): LibraryExternalFile => ({
  id, name: path.split("/").at(-1)!, originalName: "report.md", relativePath: path,
  mediaType: "text/markdown", subkind: "text", size: 1200, revision: 1,
  createdAt: 1, updatedAt, createdByName: "Original uploader", updatedByName: author,
  origin: { kind: "upload", label: "Uploaded" }, updated: "NOW", sizeLabel: "1.2 KB",
  semanticLabel: "Ready", semanticTone: "current",
  semantic: {
    ref: { kind: "externalFile::text", id: id as Id<"externalFiles"> }, overlayGeneration: 1,
    exact: { eligible: true, state: "current", objectCount: 1 },
    material: { eligible: false, state: "unsupported" }
  }
});

describe("External Files author filtering", () => {
  const files = [file("one", "north/report.md", "Mira", 10), file("two", "south/report.md", "Tomás", 20), file("three", "north/update.md", "Mira", 30)];

  it("filters by the last updater, composes with path search, and retains update ordering", () => {
    const state = new ExternalLibraryState();
    state.author = "Mira";
    state.search = "north";
    expect(visibleExternalFiles(state, files).map((row) => row.id)).toEqual(["three", "one"]);
    state.author = "Original uploader";
    expect(visibleExternalFiles(state, files)).toEqual([]);
    expect(externalAuthors(files, "")).toEqual(["Mira", "Tomás"]);
  });

  it("keeps the selected author visible after their final file changes updater", () => {
    const state = new ExternalLibraryState();
    state.author = "Tomás";
    const afterReupload = files.map((row) => ({ ...row, updatedByName: "Mira" }));
    expect(externalAuthors(afterReupload, state.author)).toEqual(["Mira", "Tomás"]);
    expect(visibleExternalFiles(state, afterReupload)).toEqual([]);
    clearLibraryFilters(state);
    expect(externalAuthors(afterReupload, state.author)).toEqual(["Mira"]);
    expect(visibleExternalFiles(state, afterReupload)).toHaveLength(3);
  });

  it("retains author filtering in directory mode and clears it with the other filters", () => {
    const state = new ExternalLibraryState();
    state.mode = "directory";
    state.currentDirectory = "north";
    state.author = "Tomás";
    expect(libraryFiltersActive(state)).toBe(true);
    expect(visibleExternalFiles(state, files)).toEqual([]);
    clearLibraryFilters(state);
    expect(libraryFiltersActive(state)).toBe(false);
    expect(visibleExternalFiles(state, files).map((row) => row.id)).toEqual(["three", "one"]);
    expect(state.currentDirectory).toBe("north");
  });
});

describe("compact update times", () => {
  it.each([
    [-1, "NOW"], [0, "NOW"], [59_999, "NOW"], [60_000, "1 MIN"],
    [3_599_999, "59 MIN"], [3_600_000, "1 HR"], [10_800_000, "3 HR"],
    [86_399_999, "23 HR"], [86_400_000, "1 D"]
  ])("formats elapsed %i milliseconds as %s", (elapsed, label) => {
    const now = Date.UTC(2026, 8, 10);
    expect(updatedTime(now - elapsed, now)).toBe(label);
  });
});

describe("External Files semantic status labels", () => {
  const current = file("one", "notes.md", "Mira", 10);

  it("distinguishes durable queued work from a claimed running job", () => {
    expect(semanticPresentation({
      ...current,
      semantic: {
        ...current.semantic,
        exact: { eligible: true, state: "queued", objectCount: 0 }
      }
    })).toEqual({ semanticLabel: "Queued", semanticTone: "queued" });
    expect(semanticPresentation({
      ...current,
      semantic: {
        ...current.semantic,
        exact: { eligible: true, state: "running", objectCount: 0 }
      }
    })).toEqual({ semanticLabel: "In progress", semanticTone: "queued" });
  });
});
