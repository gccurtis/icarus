// Structured Data types.
// Supersedes name-manager. All named values in a project live here.

import type { ContextEntry } from "#context/types.js";

export type DataKind = "variable" | "function" | "table" | "record" | "list";

// The authoritative set of value kinds — used in FieldDef and anywhere a
// resolved value type annotation is needed.
export type ValueKind =
  | "text" | "number" | "logic" | "date"
  | "table" | "record" | "list"
  | "function"
  | "unknown"; // escape hatch: not statically typeable

export interface DataEntryBase {
  readonly id: string;                      // stable UUID — never changes
  readonly kind: DataKind;
  readonly displayName: string;             // current user-visible name
  readonly description: string;            // human/AI summary
  readonly contextEntries: ContextEntry[]; // resources this entry is relevant to
  readonly revision: number;              // monotone counter; starts at 1
  readonly createdAt: string;             // ISO-8601
  readonly updatedAt: string;             // ISO-8601
  readonly deletedAt?: string;            // present means soft-deleted
}

// variable and function — body is formula source text or lambda source text
export interface FormulaEntry extends DataEntryBase {
  readonly kind: "variable" | "function";
  readonly body: string;
}

// A field in a collection schema.
// kind is the expected resolved ValueKind of every cell in this column.
// A field whose kind is "table", "record", or "list" holds nested collections.
// A list entry has no named field — schema is a single synthetic field.
export interface FieldDef {
  readonly name: string;
  readonly kind: ValueKind;
}

// A cell is either a literal value or a formula body that must resolve to the
// kind declared in the field's FieldDef at evaluation time.
export type CellLiteral = string | number | boolean | null;
export type CellFormula = { readonly formula: string };
export type CellValue = CellLiteral | CellFormula;

export type DataRow = Record<string, CellValue>;

// table (many fields, many rows), record (many fields, one row),
// list (one unnamed field, many rows — schema has one synthetic field).
// All three share the same storage shape.
export interface CollectionEntry extends DataEntryBase {
  readonly kind: "table" | "record" | "list";
  readonly schema: FieldDef[];
  readonly rows: DataRow[];
  readonly rowCount: number; // denormalised
}

export type DataEntry = FormulaEntry | CollectionEntry;

// A point-in-time view of all named entries — used by Formula to bind names.
export interface DataBindingView {
  readonly id: string;
  readonly entries: ReadonlyMap<string, DataEntry>; // keyed by displayName
  readonly viewRevision: number;                    // max revision across included entries
  readonly createdAt: string;
}

export interface DataQuery {
  readonly kind?: DataKind;
  readonly text?: string;          // substring match on displayName + description
  readonly scope?: ContextEntry[]; // filter to entries whose contextEntries overlap
}

export interface DataQueryResult {
  readonly entries: DataEntry[];
  readonly totalCount: number;
}

// ---- Error classes ----

export class DataEntryNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Data entry not found: ${id}`);
    this.name = "DataEntryNotFoundError";
  }
}

export class DataEntryConflictError extends Error {
  constructor(public readonly displayName: string) {
    super(`Data entry '${displayName}' already exists`);
    this.name = "DataEntryConflictError";
  }
}

export class StaleDataRevisionError extends Error {
  constructor(
    public readonly id: string,
    public readonly currentRevision: number,
    public readonly expectedRevision: number
  ) {
    super(`Stale revision for ${id}: expected ${expectedRevision}, current ${currentRevision}`);
    this.name = "StaleDataRevisionError";
  }
}
