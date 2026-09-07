import { expect, test } from "vitest";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import {
  applyOps,
  cellKey,
  invert,
  invertAll,
  splitCellKey
} from "$representation/data/behavior/spreadsheets/apply-ops";

const sheet = (): LiveSheet => ({
  body: {
    rows: [
      { id: "r1", order: 1 },
      { id: "r2", order: 2 },
      { id: "r3", order: 3 }
    ],
    columns: [
      { id: "c1", order: 1, width: 120 },
      { id: "c2", order: 2 }
    ],
    rowPartCounts: [3],
    formatRules: [
      {
        id: "f1",
        from: { rowId: "r1", columnId: "c1" },
        to: { rowId: "r1", columnId: "c2" },
        style: "header"
      }
    ],
    print: {
      page: {
        paper: "letter",
        orientation: "portrait",
        margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }
      }
    },
    styles: {
      styles: { body: { name: "Body" }, header: { name: "Header", fontWeight: 600 } },
      defaultKey: "body"
    }
  },
  cells: {
    "r1/c1": { rowId: "r1", columnId: "c1", value: { kind: "text", value: "Feeder" } },
    "r2/c1": { rowId: "r2", columnId: "c1", value: { kind: "number", value: 12 } },
    "r2/c2": {
      rowId: "r2",
      columnId: "c2",
      value: { kind: "number", value: 24 },
      expression: "=A2*2",
      marks: [{ id: "m1", from: { atom: "text", offset: 0 }, to: { atom: "text", offset: 2 }, style: ["bold"] }]
    }
  }
});

const set = (
  target: "cell" | "mark" | "formatRule" | "sheet",
  path: string,
  value: unknown,
  was: unknown = null
): SpreadsheetOp => ({
  op: "set",
  target,
  path,
  value,
  was
});

test("a whole-cell set on an empty coordinate makes a cell", () => {
  const next = applyOps(sheet(), [set("cell", "r3/c2", { value: { kind: "number", value: 7 } })]);

  expect(next.cells["r3/c2"]).toEqual({
    rowId: "r3",
    columnId: "c2",
    value: { kind: "number", value: 7 }
  });
});

test("a field set on an empty coordinate makes a cell around the field", () => {
  const next = applyOps(sheet(), [set("cell", "r3/c1/format/horizontalAlignment", "center")]);

  expect(next.cells["r3/c1"]).toEqual({
    rowId: "r3",
    columnId: "c1",
    value: { kind: "empty" },
    format: { horizontalAlignment: "center" }
  });
});

test("a whole-cell set to null clears the coordinate", () => {
  const next = applyOps(sheet(), [set("cell", "r2/c1", null, sheet().cells["r2/c1"])]);

  expect(next.cells["r2/c1"]).toBeUndefined();
  expect(Object.keys(next.cells)).toHaveLength(2);
});

test("a field set to null removes the field", () => {
  const next = applyOps(sheet(), [set("cell", "r2/c2/expression", null, "=A2*2")]);

  expect(next.cells["r2/c2"].expression).toBeUndefined();
  expect(next.cells["r2/c2"].value).toEqual({ kind: "number", value: 24 });
});

test("a cell set names a row and a column the body has", () => {
  expect(() => applyOps(sheet(), [set("cell", "r9/c1/value", { kind: "empty" })])).toThrow(
    /no row r9/
  );
  expect(() => applyOps(sheet(), [set("cell", "r1/c9/value", { kind: "empty" })])).toThrow(
    /no column c9/
  );
  expect(() => applyOps(sheet(), [set("cell", "r1/c1/rowId", "r2")])).toThrow(/address/);
  expect(() => applyOps(sheet(), [set("cell", "r1/c1/value", 3)])).toThrow(/kind/);
});

test("marks are inserted, set and removed by id", () => {
  const inserted = applyOps(sheet(), [
    {
      op: "insert",
      target: "mark",
      path: "r1/c1/marks",
      ids: ["m2"],
      after: null,
      values: [{ id: "m2", from: { atom: "text", offset: 0 }, to: { atom: "text", offset: 3 }, style: ["italic"] }]
    }
  ]);
  expect(inserted.cells["r1/c1"].marks).toEqual([
    { id: "m2", from: { atom: "text", offset: 0 }, to: { atom: "text", offset: 3 }, style: ["italic"] }
  ]);

  const styled = applyOps(inserted, [
    set("mark", "r1/c1/marks/m2/style", ["bold", "italic"], ["italic"])
  ]);
  expect(styled.cells["r1/c1"].marks?.[0].style).toEqual(["bold", "italic"]);

  const removed = applyOps(styled, [
    { op: "remove", target: "mark", path: "r1/c1/marks", ids: ["m2"], after: null, values: [] }
  ]);
  expect(removed.cells["r1/c1"].marks).toBeUndefined();
});

test("a mark cannot be put on a coordinate with no cell", () => {
  expect(() =>
    applyOps(sheet(), [
      {
        op: "insert",
        target: "mark",
        path: "r3/c1/marks",
        ids: ["m9"],
        after: null,
        values: [{ id: "m9", from: { atom: "text", offset: 0 }, to: { atom: "text", offset: 1 } }]
      }
    ])
  ).toThrow(/no cell at r3\/c1/);
});

test("a rule is inserted with its id, set by field and removed", () => {
  const rule = {
    id: "f2",
    from: { rowId: "r2", columnId: "c1" },
    to: { rowId: "r3", columnId: "c1" },
    format: { valueFormat: "#,##0" }
  };
  const inserted = applyOps(sheet(), [
    { op: "insert", target: "formatRule", path: "formatRules", ids: ["f2"], after: "f1", values: [rule] }
  ]);
  expect(inserted.body.formatRules.map((held) => held.id)).toEqual(["f1", "f2"]);

  const changed = applyOps(inserted, [
    set("formatRule", "formatRules/f2/format/valueFormat", "0.00", "#,##0")
  ]);
  expect(changed.body.formatRules[1].format?.valueFormat).toBe("0.00");

  const removed = applyOps(changed, [
    { op: "remove", target: "formatRule", path: "formatRules", ids: ["f2"], after: "f1", values: [rule] }
  ]);
  expect(removed.body.formatRules.map((held) => held.id)).toEqual(["f1"]);
});

test("a rule set names a rule that exists", () => {
  expect(() => applyOps(sheet(), [set("formatRule", "formatRules/f9/style", "body")])).toThrow(
    /no rule f9/
  );
});

test("inserting a row takes the midpoint order and touches no cell", () => {
  const before = sheet();
  const next = applyOps(before, [
    { op: "insert", target: "gridRow", path: "rows", ids: ["r4"], after: "r1", values: [{ id: "r4", order: 0 }] }
  ]);

  expect(next.body.rows.map((row) => row.id)).toEqual(["r1", "r4", "r2", "r3"]);
  expect(next.body.rows[1].order).toBe(1.5);
  expect(next.cells).toEqual(before.cells);
});

test("inserting a row at the top orders it before the first", () => {
  const next = applyOps(sheet(), [
    { op: "insert", target: "gridRow", path: "rows", ids: ["r0"], after: null, values: [{ id: "r0", order: 0 }] }
  ]);

  expect(next.body.rows[0].id).toBe("r0");
  expect(next.body.rows[0].order).toBeLessThan(next.body.rows[1].order);
});

test("removing a row takes its cells, and the inverse brings them back", () => {
  const before = sheet();
  const op: SpreadsheetOp = {
    op: "remove",
    target: "gridRow",
    path: "rows",
    ids: ["r2"],
    after: "r1",
    values: [{ id: "r2", order: 2, cells: [before.cells["r2/c1"], before.cells["r2/c2"]] }]
  };

  const removed = applyOps(before, [op]);
  expect(removed.body.rows.map((row) => row.id)).toEqual(["r1", "r3"]);
  expect(Object.keys(removed.cells)).toEqual(["r1/c1"]);

  const restored = applyOps(removed, [invert(op)]);
  expect(restored.body.rows.map((row) => row.id)).toEqual(["r1", "r2", "r3"]);
  expect(restored.cells["r2/c2"]).toEqual(before.cells["r2/c2"]);
});

test("removing a column takes its cells too", () => {
  const next = applyOps(sheet(), [
    { op: "remove", target: "gridColumn", path: "columns", ids: ["c2"], after: "c1", values: [{ id: "c2", order: 2 }] }
  ]);

  expect(next.body.columns.map((column) => column.id)).toEqual(["c1"]);
  expect(Object.keys(next.cells).sort()).toEqual(["r1/c1", "r2/c1"]);
});

test("a row cannot be inserted twice or removed when it is not there", () => {
  expect(() =>
    applyOps(sheet(), [
      { op: "insert", target: "gridRow", path: "rows", ids: ["r1"], after: null, values: [{ id: "r1", order: 1 }] }
    ])
  ).toThrow(/already there/);
  expect(() =>
    applyOps(sheet(), [{ op: "remove", target: "gridRow", path: "rows", ids: ["r9"], after: null, values: [] }])
  ).toThrow(/not every id/);
});

test("moving a row reorders the list and gives it a midpoint order", () => {
  const next = applyOps(sheet(), [
    { op: "move", target: "gridRow", path: "rows", id: "r3", after: "r1", wasAfter: "r2" }
  ]);

  expect(next.body.rows.map((row) => row.id)).toEqual(["r1", "r3", "r2"]);
  expect(next.body.rows[1].order).toBe(1.5);
});

test("moving a column to the front orders it before the first", () => {
  const next = applyOps(sheet(), [
    { op: "move", target: "gridColumn", path: "columns", id: "c2", after: null, wasAfter: "c1" }
  ]);

  expect(next.body.columns.map((column) => column.id)).toEqual(["c2", "c1"]);
  expect(next.body.columns[0].order).toBeLessThan(next.body.columns[1].order);
});

test("the sheet target reaches frozen counts, sizes, print and styles", () => {
  const next = applyOps(sheet(), [
    set("sheet", "frozenRows", 1),
    set("sheet", "columns/c2/width", 96),
    set("sheet", "rows/r1/height", 32),
    set("sheet", "print/page/orientation", "landscape", "portrait"),
    set("sheet", "styles/styles/header/fontWeight", 500, 600),
    set("sheet", "styles/defaultKey", "header", "body")
  ]);

  expect(next.body.frozenRows).toBe(1);
  expect(next.body.columns[1].width).toBe(96);
  expect(next.body.rows[0].height).toBe(32);
  expect(next.body.print.page.orientation).toBe("landscape");
  expect(next.body.styles.styles.header.fontWeight).toBe(500);
  expect(next.body.styles.defaultKey).toBe("header");
});

test("a sheet set refuses what the body has no field for", () => {
  expect(() => applyOps(sheet(), [set("sheet", "rows/r9/height", 20)])).toThrow(/no rows entry r9/);
  expect(() => applyOps(sheet(), [set("sheet", "frozenRows", -1)])).toThrow(/whole number/);
  expect(() => applyOps(sheet(), [set("sheet", "styles/defaultKey", "nope")])).toThrow(/exists/);
  expect(() => applyOps(sheet(), [set("sheet", "cells", {})])).toThrow(/not a field/);
});

test("styles are inserted and removed by key, and the default and a used style stay", () => {
  const added = applyOps(sheet(), [
    { op: "insert", target: "sheet", path: "styles", ids: ["total"], after: null, values: [{ name: "Total", fontWeight: 600 }] }
  ]);
  expect(added.body.styles.styles.total.name).toBe("Total");

  const removed = applyOps(added, [
    { op: "remove", target: "sheet", path: "styles", ids: ["total"], after: null, values: [{ name: "Total", fontWeight: 600 }] }
  ]);
  expect(removed.body.styles.styles.total).toBeUndefined();

  expect(() =>
    applyOps(sheet(), [{ op: "remove", target: "sheet", path: "styles", ids: ["body"], after: null, values: [] }])
  ).toThrow(/default/);
  expect(() =>
    applyOps(sheet(), [{ op: "remove", target: "sheet", path: "styles", ids: ["header"], after: null, values: [] }])
  ).toThrow(/rule still names/);
});

test("every op inverts to the op that undoes it", () => {
  const before = sheet();
  const ops: SpreadsheetOp[] = [
    set("cell", "r3/c1", { value: { kind: "text", value: "new" } }, null),
    set("cell", "r2/c1/value", { kind: "number", value: 13 }, { kind: "number", value: 12 }),
    { op: "insert", target: "gridRow", path: "rows", ids: ["r4"], after: "r3", values: [{ id: "r4", order: 4 }] },
    { op: "move", target: "gridColumn", path: "columns", id: "c2", after: null, wasAfter: "c1" },
    set("sheet", "frozenColumns", 1, null)
  ];

  const after = applyOps(before, ops);
  const back = applyOps(after, invertAll(ops));

  expect(back.cells).toEqual(before.cells);
  expect(back.body.rows.map((row) => row.id)).toEqual(before.body.rows.map((row) => row.id));
  expect(back.body.columns.map((column) => column.id)).toEqual(
    before.body.columns.map((column) => column.id)
  );
  expect(back.body.frozenColumns).toBeUndefined();
});

test("cell keys split back into a row and a column", () => {
  expect(cellKey("r7", "c3")).toBe("r7/c3");
  expect(splitCellKey("r7/c3")).toEqual({ rowId: "r7", columnId: "c3" });
  expect(splitCellKey("r7")).toBeUndefined();
  expect(splitCellKey("r7/c3/value")).toBeUndefined();
});
