import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { admitCurrentRow, admitCurrentRows } from "$representation/store/current-row";
import { CURRENT_ROW_VALUE_VALIDATORS } from "$representation/store/current-values";
import { TABLE_NAMES, type TableName } from "$representation/store/tables";

const rowsAt = (directory: "seed" | "data", table: TableName): unknown[] => {
  const path = join(process.cwd(), directory, `${table}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as unknown[] : [];
};

describe("current Store row admission", () => {
  it("registers exactly one recursive validator for every represented table", () => {
    expect(Object.keys(CURRENT_ROW_VALUE_VALIDATORS).toSorted()).toEqual([...TABLE_NAMES].toSorted());
  });

  it.each(["seed", "data"] as const)("admits every complete current row in %s", (directory) => {
    for (const table of TABLE_NAMES) {
      expect(
        () => admitCurrentRows(table, rowsAt(directory, table)),
        `${directory}/${table}.json`
      ).not.toThrow();
    }
  });

  it("rejects retired, missing, coercible, and non-round-tripping shapes before use", () => {
    const project = rowsAt("seed", "projects")[0] as Record<string, unknown>;
    expect(project).toBeDefined();
    expect(() => admitCurrentRow("projects", { ...project, legacyName: "old" })).toThrow(/unknown/);
    const { revision: _revision, ...missing } = project;
    expect(() => admitCurrentRow("projects", missing)).toThrow(/missing/);
    expect(() => admitCurrentRow("projects", {
      ...project,
      name: { toString: () => "coerced" }
    })).toThrow(/not storable/);
    expect(() => admitCurrentRow("projects", { ...project, updatedAt: Number.NaN })).toThrow(/not storable/);
  });

  it("rejects finite but out-of-range nested editor state", () => {
    const slide = structuredClone(rowsAt("seed", "presentationSnapshots")[0]) as {
      body: { slides: Array<{ elements: Array<{ frame: { width: number } }> }> };
    };
    slide.body.slides[0].elements[0].frame.width = 0;
    expect(() => admitCurrentRow("presentationSnapshots", slide)).toThrow(/non-current/);

    const documentSnapshot = structuredClone(rowsAt("seed", "documentSnapshots")[0]) as {
      body: { styles: { styles: Record<string, { fontSize?: number }> } };
    };
    documentSnapshot.body.styles.styles.body.fontSize = -1;
    expect(() => admitCurrentRow("documentSnapshots", documentSnapshot)).toThrow(/non-current/);

    const spreadsheetSnapshot = structuredClone(rowsAt("seed", "spreadsheetSnapshots")[0]) as {
      body: { print: { page: { margins: { left: number } } } };
    };
    spreadsheetSnapshot.body.print.page.margins.left = -1;
    expect(() => admitCurrentRow("spreadsheetSnapshots", spreadsheetSnapshot)).toThrow(/non-current/);
  });
});
