import { describe, expect, it } from "vitest";

import {
  distinctResourcePath,
  resourceOptionForKey,
  resourceOptionLabel
} from "$app-views/categories/research/procedures/resource-options";
import type { ResourceOption } from "$capabilities/research-chat/index.remote";
import { asId } from "$representation/data/behavior/core/id";

const option = (id: string, relativePath: string): ResourceOption => ({
  kind: "externalFile::text",
  id: asId<"externalFiles">(id),
  name: "inspection.md",
  relativePath
});

describe("research resource options", () => {
  it("selects equal filenames by their exact resource identity", () => {
    const north = option("externalFiles:north", "evidence/North/inspection.md");
    const south = option("externalFiles:south", "evidence/South/inspection.md");

    expect(resourceOptionForKey([north, south], "externalFile::text externalFiles:north"))
      .toBe(north);
    expect(resourceOptionForKey([north, south], "externalFile::text externalFiles:south"))
      .toBe(south);
    expect(resourceOptionLabel(north)).toBe(
      "inspection.md — evidence/North/inspection.md"
    );
    expect(resourceOptionLabel(south)).toBe(
      "inspection.md — evidence/South/inspection.md"
    );
  });

  it("suppresses a path that only repeats the visible filename", () => {
    const rootFile = option("externalFiles:root", "inspection.md");

    expect(distinctResourcePath(rootFile)).toBeUndefined();
    expect(resourceOptionLabel(rootFile)).toBe("inspection.md");
  });
});
