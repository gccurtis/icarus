import { randomUUID } from "node:crypto";

import { asId } from "$representation/data/behavior/core/id";
import type { Id } from "$representation/data/types/core/id";
import { admitCurrentRow } from "$representation/store/current-row";
import { asStorable, type AnyRow } from "$representation/store/path";
import type { TableName } from "$representation/store/tables";

export const mintId = <T extends TableName>(
  table: T,
  taken: ReadonlySet<string>
): Id<T> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = asId<T>(`${table}:${randomUUID()}`);
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`could not mint a unique '${table}' id`);
};

export const admittedRow = <T extends TableName>(
  table: T,
  fields: unknown,
  id: Id<T>,
  at: number
): AnyRow => {
  const admitted = asStorable(fields);
  if (admitted === null || typeof admitted !== "object" || Array.isArray(admitted)) {
    throw new Error(`a '${table}' row is an object`);
  }
  if (Object.hasOwn(admitted, "_id") || Object.hasOwn(admitted, "_creationTime")) {
    throw new Error(`a '${table}' create cannot supply Store-owned identity fields`);
  }
  return admitCurrentRow(table, {
    ...(admitted as Record<string, unknown>),
    _id: id,
    _creationTime: at
  }) as unknown as AnyRow;
};

export const requireRows = <T extends TableName>(
  current: readonly AnyRow[],
  table: T,
  ids: readonly Id<T>[]
): ReadonlySet<string> => {
  const wanted = new Set<string>(ids);
  const found = new Set(current.filter((row) => wanted.has(row._id)).map((row) => row._id));
  const missing = ids.find((id) => !found.has(id));
  if (missing !== undefined) throw new Error(`no '${table}' row ${missing}`);
  return wanted;
};
