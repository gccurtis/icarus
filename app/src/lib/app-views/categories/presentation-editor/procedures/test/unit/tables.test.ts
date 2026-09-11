import { describe, expect, it } from "vitest";

import type { PresentationBody } from "$representation/data/types/presentations/body";
import type { TableBlock } from "$representation/data/types/content/content-block";
import {
  columnsOf,
  gridOf,
  isRectangular,
  rectangleOf,
  withColumnInserted,
  withColumnRemoved,
  withMergedCells,
  withRowInserted,
  withRowRemoved,
  withSplitCell
} from "$app-views/categories/presentation-editor/procedures/tables";

const cell = (id: string, spans: { rowSpan?: number; columnSpan?: number } = {}) => ({ id, blocks: [], ...spans });

const table = (): TableBlock => ({
  id: "t1",
  type: "table",
  headerRows: 1,
  rows: [
    { id: "r1", cells: [cell("a1"), cell("b1"), cell("c1")] },
    { id: "r2", cells: [cell("a2"), cell("b2"), cell("c2")] },
    { id: "r3", cells: [cell("a3"), cell("b3"), cell("c3")] }
  ]
});

const presentation = (block: TableBlock): PresentationBody => ({
  aspectRatio: "16:9",
  theme: { colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" } },
  styles: { defaultKey: "body", styles: {} },
  layouts: [],
  sections: [],
  slides: [{ id: "s1", notes: [], elements: [{ id: "e1", frame: { x: 0, y: 0, width: 1, height: 1 }, content: { type: "table", block } }] }]
});

const tableIn = (body: PresentationBody): TableBlock => {
  const content = body.slides[0].elements[0].content;
  if (content.type !== "table") throw new Error("not a table");
  return content.block;
};

describe("a table is a grid", () => {
  it("places every cell by row and column, spans included", () => {
    const grid = gridOf(table());
    expect(grid.find((held) => held.cell.id === "b2")).toMatchObject({ row: 1, column: 1 });
    expect(columnsOf(grid)).toBe(3);
  });

  it("knows whether a selection is a rectangle", () => {
    const grid = gridOf(table());
    expect(rectangleOf(grid, ["a1", "b2"])).toEqual({ top: 0, left: 0, bottom: 1, right: 1 });
    expect(isRectangular(grid, ["a1", "b2"])).toBe(false);
    expect(isRectangular(grid, ["a1", "b1", "a2", "b2"])).toBe(true);
  });
});

describe("merging and splitting", () => {
  it("merges a rectangle into its top-left cell and drops the rest", () => {
    const merged = withMergedCells(presentation(table()), table(), ["a1", "b1", "a2", "b2"]);
    const next = tableIn(merged.body);
    expect(next.rows[0].cells.map((held) => held.id)).toEqual(["a1", "c1"]);
    expect(next.rows[1].cells.map((held) => held.id)).toEqual(["c2"]);
    expect(next.rows[0].cells[0]).toMatchObject({ rowSpan: 2, columnSpan: 2 });
    const grid = gridOf(next);
    expect(grid.find((held) => held.cell.id === "c2")).toMatchObject({ row: 1, column: 2 });
  });

  it("refuses to merge an L", () => {
    expect(withMergedCells(presentation(table()), table(), ["a1", "b1", "a2"]).ops).toEqual([]);
  });

  it("keeps the first-picked cell and moves it to the top-left of the rectangle", () => {
    const merged = withMergedCells(presentation(table()), table(), ["b2", "a1", "b1", "a2"]);
    const next = tableIn(merged.body);
    expect(next.rows[0].cells.map((held) => held.id)).toEqual(["b2", "c1"]);
    expect(next.rows[1].cells.map((held) => held.id)).toEqual(["c2"]);
    expect(gridOf(next).find((held) => held.cell.id === "b2")).toMatchObject({ row: 0, column: 0, rowSpan: 2, columnSpan: 2 });
  });

  it("inserts and removes rows and columns around a cell", () => {
    const body = presentation(table());
    const element = body.slides[0].elements[0];
    const wider = withColumnInserted(body, element, 0);
    expect(tableIn(wider.body).rows.every((row) => row.cells.length === 4)).toBe(true);
    expect(tableIn(wider.body).rows[0].cells[1].id).not.toBe("b1");
    const narrower = withColumnRemoved(wider.body, wider.body.slides[0].elements[0], 1);
    expect(tableIn(narrower.body).rows[0].cells.map((held) => held.id)).toEqual(["a1", "b1", "c1"]);
    const taller = withRowInserted(body, element, 0);
    expect(tableIn(taller.body).rows).toHaveLength(4);
    expect(tableIn(taller.body).rows[1].cells).toHaveLength(3);
    const shorter = withRowRemoved(taller.body, taller.body.slides[0].elements[0], 1);
    expect(tableIn(shorter.body).rows.map((row) => row.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("splits a merged cell back into single cells in the right columns", () => {
    const merged = withMergedCells(presentation(table()), table(), ["a1", "b1", "a2", "b2"]);
    const split = withSplitCell(merged.body, tableIn(merged.body), "a1");
    const next = tableIn(split.body);
    expect(next.rows[0].cells).toHaveLength(3);
    expect(next.rows[1].cells).toHaveLength(3);
    expect(next.rows[0].cells[0].rowSpan).toBeUndefined();
    const grid = gridOf(next);
    expect(grid.find((held) => held.cell.id === "c2")).toMatchObject({ row: 1, column: 2 });
    expect(grid.filter((held) => held.row === 1).map((held) => held.column)).toEqual([0, 1, 2]);
  });
});
