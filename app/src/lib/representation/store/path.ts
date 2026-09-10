import { asRowId, asTable } from "$representation/store/admission";
import type { TableName, TableRow } from "$representation/store/tables";
import type { Id } from "$representation/data/types/core/id";

/** `<table>[.<id>[.<field>…]]`. Every dot is one step further into the row. */
export type StorePath = {
  readonly table: TableName;
  readonly id?: Id<TableName>;
  readonly fields: readonly string[];
};

/**
 * What a read found, and where. The table is a literal, so a caller that
 * switches on it narrows the row it is holding.
 */
export type Found = {
  [T in TableName]:
    | { readonly table: T; readonly kind: "table"; readonly rows: readonly TableRow<T>[] }
    | { readonly table: T; readonly kind: "row"; readonly row: TableRow<T> }
    | {
        readonly table: T;
        readonly kind: "field";
        readonly fields: readonly string[];
        readonly value: unknown;
      };
}[TableName];

/** Any row, of any table. What the store holds before a caller says which one. */
export type AnyRow = TableRow<TableName>;

type Fields = Record<string, unknown>;

/**
 * The one cast in this file. `Found` is a union for the reader to switch on;
 * building a member of it from a table name that is itself the union cannot be
 * proved, only assembled correctly.
 */
const found = (value: object): Found => value as unknown as Found;

export const asPath = (value: unknown): StorePath => {
  if (typeof value !== "string" || value.length === 0) throw new Error("A store path is a string");
  const [table, id, ...fields] = value.split(".");
  return {
    table: asTable(table),
    ...(id === undefined ? {} : { id: asRowId(id) }),
    fields
  };
};

const at = (value: unknown, fields: readonly string[]): unknown =>
  fields.reduce<unknown>(
    (step, field) => (step === null || typeof step !== "object" ? undefined : (step as Fields)[field]),
    value
  );

/** A copy of `value` with `fields` set to `next`, creating nothing that is not there. */
const withField = (value: unknown, fields: readonly string[], next: unknown): unknown => {
  const [field, ...rest] = fields;
  if (field === undefined) return next;
  if (value === null || typeof value !== "object") throw new Error(`no '${field}' to write`);

  const inner = withField((value as Fields)[field], rest, next);
  if (Array.isArray(value)) {
    const copy = [...value];
    copy[Number(field)] = inner;
    return copy;
  }
  return { ...(value as Fields), [field]: inner };
};

const withoutField = (value: unknown, fields: readonly string[]): unknown => {
  const [field, ...rest] = fields;
  if (field === undefined) throw new Error("nothing to remove");
  if (value === null || typeof value !== "object") throw new Error(`no '${field}' to remove`);

  if (rest.length > 0) {
    return withField(value, [field], withoutField((value as Fields)[field], rest));
  }
  if (Array.isArray(value)) return value.filter((_, index) => index !== Number(field));

  const kept: Fields = { ...(value as Fields) };
  delete kept[field];
  return kept;
};

const rowOf = (rows: readonly AnyRow[], id: Id<TableName>) => rows.find((row) => row._id === id);

const required = (rows: readonly AnyRow[], path: StorePath): AnyRow => {
  if (path.id === undefined) throw new Error(`'${path.table}' is a table, not a row`);
  const row = rowOf(rows, path.id);
  if (row === undefined) throw new Error(`no '${path.table}' row ${path.id}`);
  return row;
};

export const readAt = (rows: readonly AnyRow[], path: StorePath): Found | undefined => {
  if (path.id === undefined) return found({ table: path.table, kind: "table", rows });

  const row = rowOf(rows, path.id);
  if (row === undefined) return undefined;
  if (path.fields.length === 0) return found({ table: path.table, kind: "row", row });

  const value = at(row, path.fields);
  return value === undefined
    ? undefined
    : found({ table: path.table, kind: "field", fields: path.fields, value });
};

/** `_id` and `_creationTime` are the store's, so a write cannot reach them. */
const KEPT = ["_id", "_creationTime"] as const;

export const writtenAt = (
  rows: readonly AnyRow[],
  path: StorePath,
  next: unknown
): readonly AnyRow[] => {
  const row = required(rows, path);
  if (path.fields[0] === "_id" || path.fields[0] === "_creationTime") {
    throw new Error("Store-owned identity fields cannot be written");
  }
  if (
    path.fields.length === 0 &&
    (next === null || typeof next !== "object" || Array.isArray(next) ||
      Object.hasOwn(next, "_id") || Object.hasOwn(next, "_creationTime"))
  ) {
    throw new Error("a row replacement cannot supply Store-owned identity fields");
  }

  const written =
    path.fields.length === 0
      ? { ...(next as Fields), ...Object.fromEntries(KEPT.map((field) => [field, row[field]])) }
      : withField(row, path.fields, next);

  return rows.map((candidate) => (candidate._id === row._id ? (written as AnyRow) : candidate));
};

export const removedAt = (rows: readonly AnyRow[], path: StorePath): readonly AnyRow[] => {
  const row = required(rows, path);
  if (path.fields[0] === "_id" || path.fields[0] === "_creationTime") {
    throw new Error("Store-owned identity fields cannot be removed");
  }
  if (path.fields.length === 0) return rows.filter((candidate) => candidate._id !== row._id);

  const written = withoutField(row, path.fields) as AnyRow;
  return rows.map((candidate) => (candidate._id === row._id ? written : candidate));
};

const hasOnlyDataProperties = (
  value: object,
  keys: readonly string[],
  nonEnumerable: readonly string[] = []
): boolean => {
  const ownKeys = Reflect.ownKeys(value);
  const stringKeys = ownKeys.filter((key): key is string => typeof key === "string");
  if (stringKeys.length !== ownKeys.length) return false;
  if (stringKeys.length !== keys.length || stringKeys.some((key) => !keys.includes(key))) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor &&
      descriptor.enumerable === !nonEnumerable.includes(key);
  });
};

/** Refuses anything whose value JSON persistence would omit, coerce, or reshape. */
export const asStorable = (value: unknown): unknown => {
  const ancestors = new WeakSet<object>();
  const walk = (step: unknown): unknown => {
    if (step === undefined) throw new Error("undefined is not storable");
    if (typeof step === "function" || typeof step === "symbol" || typeof step === "bigint") {
      throw new Error(`${typeof step} is not storable`);
    }
    if (typeof step === "number" && (!Number.isFinite(step) || Object.is(step, -0))) {
      throw new Error("a non-finite or negative-zero number is not storable");
    }
    if (step === null || typeof step !== "object") return step;
    if (ancestors.has(step)) throw new Error("a cycle is not storable");
    ancestors.add(step);

    if (Array.isArray(step)) {
      if (Object.getPrototypeOf(step) !== Array.prototype) {
        throw new Error("a custom-prototype array is not storable");
      }
      const keys = Object.keys(step);
      if (
        !hasOnlyDataProperties(step, [...keys, "length"], ["length"]) ||
        keys.length !== step.length ||
        keys.some((key, index) => key !== String(index))
      ) {
        throw new Error("a sparse, decorated, or accessor array is not storable");
      }
      for (const entry of step) walk(entry);
    } else {
      const prototype = Object.getPrototypeOf(step);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error("a custom-prototype object is not storable");
      }
      const keys = Object.keys(step);
      if (!hasOnlyDataProperties(step, keys)) {
        throw new Error("a hidden, symbolic, or accessor property is not storable");
      }
      for (const key of keys) walk((step as Fields)[key]);
    }
    ancestors.delete(step);
    return step;
  };
  return walk(value);
};
