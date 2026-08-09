import { createHash } from "node:crypto";
import type { FormulaValue } from "./value.js";

/** Canonical internal identity payload. Unlike wire encoding, functions are supported. */
export function formulaValueIdentityPayload(value: FormulaValue): unknown {
  switch (value.kind) {
    case "null":
      return { kind: "null" };
    case "number":
      return {
        kind: "number",
        numerator: value.value.numerator.toString(),
        denominator: value.value.denominator.toString()
      };
    case "text":
    case "logic":
      return { kind: value.kind, value: value.value };
    case "list":
    case "record":
    case "table":
      return {
        kind: value.kind,
        fields: [...value.table.fields],
        rows: value.table.rows.map(row => row.map(formulaValueIdentityPayload))
      };
    case "function":
      return value.fn.kind === "lambda"
        ? {
            kind: "function",
            functionKind: "lambda",
            identityDigest: value.fn.identityDigest
          }
        : {
            kind: "function",
            functionKind: "builtin",
            name: value.fn.name,
            implementationVersion: value.fn.implementationVersion
          };
  }
}

export function formulaValueDigest(value: FormulaValue): string {
  return createHash("sha256")
    .update(JSON.stringify(formulaValueIdentityPayload(value)))
    .digest("hex")
    .slice(0, 32);
}
