import type { CanonicalRational } from "./rational.js";
import type { FormulaValue } from "./value.js";
import type { FormulaWireValue } from "./wire.js";
import { fromWire } from "./wire.js";

/** Deterministic, presentation-neutral text for a Formula value. */
export function formatFormulaValue(value: FormulaValue): string {
  return formatValue(value, false);
}

/** Wire-value companion used after a value has crossed a persistence seam. */
export function formatFormulaWireValue(value: FormulaWireValue): string {
  return formatFormulaValue(fromWire(value));
}

function formatValue(value: FormulaValue, nested: boolean): string {
  switch (value.kind) {
    case "null":
      return "null";
    case "number":
      return formatRational(value.value);
    case "text":
      return nested ? JSON.stringify(value.value) : value.value;
    case "logic":
      return value.value ? "true" : "false";
    case "list":
      return `[${value.table.rows
        .map((row) => row[0] ? formatValue(row[0], true) : "null")
        .join(", ")}]`;
    case "record":
      return formatRecord(value.table.fields, value.table.rows[0] ?? []);
    case "table":
      return `[${value.table.rows
        .map((row) => formatRecord(value.table.fields, row))
        .join(", ")}]`;
    case "function":
      return value.fn.kind === "builtin"
        ? `[function ${value.fn.name}]`
        : `[function lambda(${value.fn.parameters.join(", ")})]`;
  }
}

function formatRecord(
  fields: readonly string[],
  row: readonly FormulaValue[],
): string {
  return `{${fields.map((field, index) => {
    const value = row[index];
    return `${JSON.stringify(field)}: ${value ? formatValue(value, true) : "null"}`;
  }).join(", ")}}`;
}

function formatRational(value: CanonicalRational): string {
  if (value.denominator === 1n) return value.numerator.toString();

  let remaining = value.denominator;
  let twos = 0;
  let fives = 0;
  while (remaining % 2n === 0n) {
    remaining /= 2n;
    twos += 1;
  }
  while (remaining % 5n === 0n) {
    remaining /= 5n;
    fives += 1;
  }

  if (remaining !== 1n) {
    return `${value.numerator.toString()}/${value.denominator.toString()}`;
  }

  const places = Math.max(twos, fives);
  const scale = 10n ** BigInt(places);
  const negative = value.numerator < 0n;
  const absoluteNumerator = negative ? -value.numerator : value.numerator;
  const scaled = (absoluteNumerator * scale) / value.denominator;
  const digits = scaled.toString().padStart(places + 1, "0");
  const integer = digits.slice(0, -places) || "0";
  const fraction = digits.slice(-places).replace(/0+$/, "");
  const magnitude = fraction.length > 0 ? `${integer}.${fraction}` : integer;
  return negative ? `-${magnitude}` : magnitude;
}
