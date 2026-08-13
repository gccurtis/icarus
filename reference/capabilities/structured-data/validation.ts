import type {
  CellValue,
  CollectionEntry,
  DataKind,
  DataRow,
  FieldDef,
  ValueKind
} from "./types.js";

const FORMULA_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORMULA_RESERVED_NAMES = new Set([
  "true", "false", "null", "if", "lambda", "function",
  "sum", "product", "min", "max", "avg", "average", "count",
  "abs", "mod", "power", "pow", "round", "floor", "ceil", "ceiling",
  "table", "rows", "columns", "not", "and", "or", "text", "number", "concat"
]);
const DATA_KINDS = new Set<DataKind>(["variable", "function", "table", "record", "list"]);
const SUPPORTED_FIELD_KINDS = new Set<ValueKind>([
  "text",
  "number",
  "logic",
  "table",
  "record",
  "list",
  "unknown"
]);

export class DataValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(`${field}: ${message}`);
    this.name = "DataValidationError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function canonicalizeDisplayName(displayName: string): string {
  return displayName.trim();
}

/** Must stay aligned with Formula's ASCII, case-insensitive identifier lookup. */
export function normalizeDisplayNameKey(displayName: string): string {
  return canonicalizeDisplayName(displayName).toLowerCase();
}

export function validateDisplayName(displayName: unknown, maxBytes: number): string {
  if (typeof displayName !== "string") {
    throw new DataValidationError("displayName", "must be a string");
  }
  const canonical = canonicalizeDisplayName(displayName);
  if (canonical.length === 0) {
    throw new DataValidationError("displayName", "must not be blank");
  }
  if (!FORMULA_IDENTIFIER.test(canonical)) {
    throw new DataValidationError(
      "displayName",
      "must be an ASCII Formula identifier beginning with a letter or underscore"
    );
  }
  if (FORMULA_RESERVED_NAMES.has(normalizeDisplayNameKey(canonical))) {
    throw new DataValidationError("displayName", "is reserved by Formula");
  }
  const byteLength = Buffer.byteLength(canonical, "utf8");
  if (byteLength > maxBytes) {
    throw new DataValidationError("displayName", `exceeds maxDisplayNameBytes (${maxBytes})`);
  }
  return canonical;
}

export function validateDataKind(kind: unknown): DataKind {
  if (typeof kind !== "string" || !DATA_KINDS.has(kind as DataKind)) {
    throw new DataValidationError("kind", `unsupported data kind: ${String(kind)}`);
  }
  return kind as DataKind;
}

export function validateFormulaBody(body: unknown, maxBytes: number, field = "body"): string {
  if (typeof body !== "string") {
    throw new DataValidationError(field, "must be a string");
  }
  if (body.trim().length === 0) {
    throw new DataValidationError(field, "must not be blank");
  }
  const byteLength = Buffer.byteLength(body, "utf8");
  if (byteLength > maxBytes) {
    throw new DataValidationError(field, `exceeds maxBodyBytes (${maxBytes})`);
  }
  return body;
}

export function validateCollectionSchema(
  collectionKind: CollectionEntry["kind"],
  schema: unknown,
  maxFields: number
): FieldDef[] {
  if (!Array.isArray(schema)) {
    throw new DataValidationError("schema", "must be an array");
  }
  if (schema.length > maxFields) {
    throw new DataValidationError("schema", `exceeds maxFieldsPerCollection (${maxFields})`);
  }
  if (collectionKind === "list" && schema.length !== 1) {
    throw new DataValidationError("schema", "list entries require exactly one field");
  }

  const names = new Set<string>();
  return schema.map((candidate, index) => {
    if (!isPlainObject(candidate)) {
      throw new DataValidationError(`schema[${index}]`, "must be an object");
    }
    const name = validateDisplayName(candidate.name, 256);
    const normalizedName = normalizeDisplayNameKey(name);
    if (names.has(normalizedName)) {
      throw new DataValidationError(`schema[${index}].name`, `duplicate field: ${name}`);
    }
    names.add(normalizedName);

    const kind = candidate.kind;
    if (typeof kind !== "string" || !SUPPORTED_FIELD_KINDS.has(kind as ValueKind)) {
      throw new DataValidationError(
        `schema[${index}].kind`,
        `unsupported field kind: ${String(kind)}`
      );
    }
    return { name, kind: kind as ValueKind };
  });
}

function validateLiteralKind(value: string | number | boolean, expected: ValueKind, field: string): void {
  if (expected === "unknown") return;
  const actual = typeof value === "boolean"
    ? "logic"
    : typeof value === "string"
      ? "text"
      : "number";
  if (actual !== expected) {
    throw new DataValidationError(field, `expected ${expected}, received ${actual}`);
  }
}

function validateCell(
  value: unknown,
  expectedKind: ValueKind,
  field: string,
  maxBodyBytes: number
): CellValue {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") {
    validateLiteralKind(value, expectedKind, field);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new DataValidationError(field, "number must be finite");
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new DataValidationError(field, "integer must be within JavaScript's safe integer range");
    }
    validateLiteralKind(value, expectedKind, field);
    return value;
  }
  if (!isPlainObject(value)) {
    throw new DataValidationError(field, "unsupported cell value");
  }
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "formula") {
    throw new DataValidationError(field, "formula cells must contain only a formula string");
  }
  return {
    formula: validateFormulaBody(value.formula, maxBodyBytes, `${field}.formula`)
  };
}

export function validateCollectionRows(
  collectionKind: CollectionEntry["kind"],
  schema: readonly FieldDef[],
  rows: unknown,
  maxRows: number,
  maxBodyBytes: number
): DataRow[] {
  if (!Array.isArray(rows)) {
    throw new DataValidationError("rows", "must be an array");
  }
  if (rows.length > maxRows) {
    throw new DataValidationError("rows", `exceeds maxRowsPerCollection (${maxRows})`);
  }
  if (collectionKind === "record" && rows.length !== 1) {
    throw new DataValidationError("rows", "record entries require exactly one row");
  }

  const fields = new Map(schema.map(field => [field.name, field]));
  return rows.map((candidate, rowIndex) => {
    if (!isPlainObject(candidate)) {
      throw new DataValidationError(`rows[${rowIndex}]`, "must be an object");
    }
    const normalized: DataRow = {};
    for (const [key, value] of Object.entries(candidate)) {
      const field = fields.get(key);
      if (!field) {
        throw new DataValidationError(`rows[${rowIndex}].${key}`, "is not declared in the schema");
      }
      normalized[key] = validateCell(
        value,
        field.kind,
        `rows[${rowIndex}].${key}`,
        maxBodyBytes
      );
    }
    return normalized;
  });
}

export function validateAppendRows(
  entry: CollectionEntry,
  rows: unknown,
  maxRows: number,
  maxBodyBytes: number
): DataRow[] {
  if (!Array.isArray(rows)) {
    throw new DataValidationError("rows", "must be an array");
  }
  const finalRowCount = entry.rows.length + rows.length;
  if (finalRowCount > maxRows) {
    throw new DataValidationError("rows", `would exceed maxRowsPerCollection (${maxRows})`);
  }
  if (entry.kind === "record" && finalRowCount !== 1) {
    throw new DataValidationError("rows", "record entries require exactly one row");
  }
  // Validate only the new payload. Existing values were admitted by an earlier
  // mutation and are not rescanned on every append.
  return validateCollectionRows(
    entry.kind === "record" ? "table" : entry.kind,
    entry.schema,
    rows,
    rows.length,
    maxBodyBytes
  );
}

export function validateDeleteIndices(
  entry: CollectionEntry,
  indices: unknown
): number[] {
  if (!Array.isArray(indices)) {
    throw new DataValidationError("indices", "must be an array");
  }
  const unique = new Set<number>();
  for (const candidate of indices) {
    if (!Number.isInteger(candidate)) {
      throw new DataValidationError("indices", "must contain only integers");
    }
    const index = candidate as number;
    if (index < 0 || index >= entry.rows.length) {
      throw new DataValidationError("indices", `row index out of range: ${index}`);
    }
    if (unique.has(index)) {
      throw new DataValidationError("indices", `duplicate row index: ${index}`);
    }
    unique.add(index);
  }
  if (entry.kind === "record" && entry.rows.length - unique.size !== 1) {
    throw new DataValidationError("indices", "record entries require exactly one row");
  }
  return [...unique];
}
