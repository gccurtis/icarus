// Wire encoding — FormulaValue ↔ JSON-safe FormulaWireValue.
// Functions are not serializable as values; they render as descriptors.

import type { FormulaValue, FormulaTable } from "./value.js";
import type { RationalWire } from "./rational.js";
import { toWire as rToWire, fromWire as rFromWire } from "./rational.js";
import {
  NULL_VALUE, makeNumber, makeText, makeLogic, makeList, makeRecord, makeTable
} from "./value.js";

export type FormulaWireValue =
  | { readonly kind: "null" }
  | { readonly kind: "number"; readonly numerator: string; readonly denominator: string }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "logic"; readonly value: boolean }
  | { readonly kind: "list" | "record" | "table"; readonly fields: readonly string[]; readonly rows: FormulaWireValue[][] };

export function toWire(v: FormulaValue): FormulaWireValue {
  switch (v.kind) {
    case "null": return { kind: "null" };
    case "number": {
      const w = rToWire(v.value);
      return { kind: "number", numerator: w.numerator, denominator: w.denominator };
    }
    case "text": return { kind: "text", value: v.value };
    case "logic": return { kind: "logic", value: v.value };
    case "list":
    case "record":
    case "table":
      return {
        kind: v.kind,
        fields: [...v.table.fields],
        rows: v.table.rows.map(row => row.map(cell => toWire(cell)))
      };
    case "function":
      // Functions are not representable as wire values — return null as fallback
      return { kind: "null" };
  }
}

export function fromWire(w: FormulaWireValue): FormulaValue {
  switch (w.kind) {
    case "null": return NULL_VALUE;
    case "number": return makeNumber(rFromWire({ numerator: w.numerator, denominator: w.denominator }));
    case "text": return makeText(w.value);
    case "logic": return makeLogic(w.value);
    case "list": {
      const elements = w.rows.map(row => fromWire(row[0]));
      return makeList(elements);
    }
    case "record": {
      const values = w.rows[0]?.map(c => fromWire(c)) ?? [];
      return makeRecord([...w.fields], values);
    }
    case "table": {
      const rows = w.rows.map(row => row.map(c => fromWire(c)));
      return makeTable([...w.fields], rows);
    }
  }
}
