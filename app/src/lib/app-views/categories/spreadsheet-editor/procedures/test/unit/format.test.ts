import { describe, expect, it } from "vitest";

import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { coerced } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import {
  PLAIN,
  formatNumber,
  partsOf,
  patternOf,
  reconciled
} from "$app-views/categories/spreadsheet-editor/procedures/number-format";

const sheet = (): LiveSheet => ({
  body: {
    rows: [{ id: "r1", order: 1 }],
    columns: [
      { id: "c1", order: 1 },
      { id: "c2", order: 2 },
      { id: "c3", order: 3 }
    ],
    rowPartCounts: [1],
    formatRules: [],
    print: { page: { paper: "letter", orientation: "portrait", margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } } },
    styles: { styles: { body: { name: "Body" } }, defaultKey: "body" }
  },
  cells: {
    "r1/c1": { rowId: "r1", columnId: "c1", value: { kind: "text", value: "1,250" } },
    "r1/c2": { rowId: "r1", columnId: "c2", value: { kind: "number", value: 0 } },
    "r1/c3": { rowId: "r1", columnId: "c3", value: { kind: "text", value: "Ashgrove" } }
  }
});

describe("the number format builder", () => {
  it("reads a pattern into its parts and writes the parts back as a pattern", () => {
    expect(partsOf(undefined)).toEqual(PLAIN);
    expect(partsOf("#,##0.00")).toEqual({ prefix: "", suffix: "", decimals: 2, mark: ".", thousands: "," });
    expect(partsOf("€#.##0,0")).toEqual({ prefix: "€", suffix: "", decimals: 1, mark: ",", thousands: "." });
    expect(partsOf("0.0%")).toEqual({ prefix: "", suffix: "%", decimals: 1, mark: ".", thousands: "none" });
    expect(partsOf("$#,##0")).toEqual({ prefix: "$", suffix: "", decimals: 0, mark: ".", thousands: "," });
    expect(partsOf("#,##0.# kWh")).toEqual({ prefix: "", suffix: " kWh", decimals: undefined, mark: ".", thousands: "," });
    expect(partsOf('"No. "0')).toEqual({ prefix: "No. ", suffix: "", decimals: 0, mark: ".", thousands: "none" });

    expect(patternOf({ prefix: "£", suffix: "", decimals: 2, mark: ".", thousands: "," })).toBe("£#,##0.00");
    expect(patternOf({ prefix: "", suffix: "", decimals: 0, mark: ",", thousands: "." })).toBe("#.##0");
    expect(patternOf({ prefix: "", suffix: "%", decimals: 1, mark: ".", thousands: "none" })).toBe("0.0%");
    expect(patternOf({ prefix: "", suffix: " kWh", decimals: undefined, mark: ".", thousands: " " })).toBe("# ##0.# kWh");
    expect(patternOf({ prefix: "No. ", suffix: "", decimals: 0, mark: ".", thousands: "none" })).toBe('"No. "0');
    expect(patternOf(PLAIN)).toBeNull();
  });

  it("keeps the decimal mark and the thousands separator apart", () => {
    expect(reconciled({ ...PLAIN, mark: ",", thousands: "," }, "mark")).toMatchObject({ mark: ",", thousands: "." });
    expect(reconciled({ ...PLAIN, mark: ".", thousands: "." }, "thousands")).toMatchObject({ mark: ",", thousands: "." });
    expect(reconciled({ ...PLAIN, mark: ".", thousands: "," }, "mark")).toMatchObject({ mark: ".", thousands: "," });
  });

  it("formats with any prefix, suffix and separators", () => {
    expect(formatNumber(1234.5, "#.##0,00")).toBe("1.234,50");
    expect(formatNumber(1234.5, "€#,##0.00")).toBe("€1,234.50");
    expect(formatNumber(0.125, "0.0%")).toBe("12.5%");
    expect(formatNumber(1234.5, "# ##0.# kWh")).toBe("1 234.5 kWh");
    expect(formatNumber(-42, '"No. "0')).toBe("-No. 42");
    expect(formatNumber(1234.5678, "0.#")).toBe("1234.5678");
    expect(formatNumber(1234.5)).toBe("1234.5");
  });
});

describe("retyping a cell", () => {
  it("coerces what reads as the kind and refuses what does not", () => {
    expect(coerced(sheet(), { rowId: "r1", columnId: "c1" }, "number").ops).toEqual([
      { op: "set", target: "cell", path: "r1/c1/value", value: { kind: "number", value: 1250 }, was: { kind: "text", value: "1,250" } }
    ]);
    expect(coerced(sheet(), { rowId: "r1", columnId: "c3" }, "number").refused).toMatch(/does not read/);
    expect(coerced(sheet(), { rowId: "r1", columnId: "c2" }, "logic").ops[0]).toMatchObject({ value: { kind: "logic", value: false } });
    expect(coerced(sheet(), { rowId: "r1", columnId: "c2" }, "text").ops[0]).toMatchObject({ value: { kind: "text", value: "0" } });
    expect(coerced(sheet(), { rowId: "r1", columnId: "c2" }, "number").ops).toEqual([]);
  });
});
