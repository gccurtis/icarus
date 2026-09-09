import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { keyOf, type CellRef } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import { set } from "$app-views/categories/spreadsheet-editor/procedures/cells";
import type { Edit } from "$app-views/categories/spreadsheet-editor/procedures/spans";
import {
  displayOf,
  parseTyped,
  sameValue
} from "$app-views/categories/spreadsheet-editor/procedures/values";

export type CellKind = "number" | "text" | "logic" | "date";

const asKind = (value: FormulaValue, kind: CellKind): FormulaValue | undefined => {
  if (value.kind === kind) return value;
  const text =
    value.kind === "text"
      ? value.value
      : value.kind === "number" || value.kind === "logic"
        ? String(value.value)
        : "";
  switch (kind) {
    case "text":
      return { kind: "text", value: text };
    case "number": {
      const parsed = parseTyped(text);
      return parsed.kind === "value" && parsed.value.kind === "number" ? parsed.value : undefined;
    }
    case "logic": {
      if (value.kind === "number") return { kind: "logic", value: value.value !== 0 };
      const word = text.trim().toLowerCase();
      if (word === "true" || word === "1" || word === "yes") {
        return { kind: "logic", value: true };
      }
      return word === "false" || word === "0" || word === "no" || word === ""
        ? { kind: "logic", value: false }
        : undefined;
    }
    case "date": {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
      if (match === null) return undefined;
      const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
      return {
        kind: "date",
        value: { calendar: "gregorian", year, month, day, utc: Date.UTC(year, month - 1, day) }
      };
    }
  }
};

export const coerced = (sheet: LiveSheet, ref: CellRef, kind: CellKind): Edit => {
  const key = keyOf(ref);
  const held = sheet.cells[key];
  if (held === undefined || held.value.kind === "reference") return { ops: [] };
  const next = asKind(held.value, kind);
  if (next === undefined) {
    return { ops: [], refused: `${displayOf(held.value)} does not read as a ${kind}.` };
  }
  if (sameValue(held.value, next)) return { ops: [] };
  return { ops: [set(`${key}/value`, next, held.value)] };
};
