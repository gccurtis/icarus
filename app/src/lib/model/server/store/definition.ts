import { randomUUID } from "node:crypto";

import { asPath, readAt, removedAt, writtenAt, asStorable } from "$representation/store/path";
import type { AnyRow } from "$representation/store/path";
import { asId } from "$representation/data/behavior/core/id";
import type { Id } from "$representation/data/types/core/id";
import type { TableName } from "$representation/store/tables";

import { load } from "$model/server/store/methods/shared/load.server";
import { persist } from "$model/server/store/methods/shared/persist.server";
import type { StoreInput, StoreModel } from "$model/server/store/types";

export const defineStore = ({ directory, now = Date.now }: StoreInput): StoreModel => {
  const tables = load(directory);
  const rowsOf = (table: TableName): readonly AnyRow[] => tables.get(table) ?? [];

  /**
   * Row identities are opaque and never derived from the rows that happen to
   * remain. A highest-row + 1 allocator can reuse an id after deletion, letting
   * a stale browser tab address an unrelated replacement (the ABA problem).
   */
  const mintId = <T extends TableName>(table: T, taken: ReadonlySet<string>): Id<T> => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = asId<T>(`${table}:${randomUUID()}`);
      if (!taken.has(candidate)) return candidate;
    }
    throw new Error(`could not mint a unique '${table}' id`);
  };

  const admittedRow = <T extends TableName>(
    table: T,
    fields: unknown,
    id: Id<T>,
    at: number
  ): AnyRow => {
    const admitted = asStorable(fields);
    if (admitted === null || typeof admitted !== "object" || Array.isArray(admitted)) {
      throw new Error(`a '${table}' row is an object`);
    }
    return {
      ...(admitted as Record<string, unknown>),
      _id: id,
      _creationTime: at
    } as unknown as AnyRow;
  };

  const commit = (table: TableName, rows: readonly AnyRow[]) => {
    persist(directory, table, rows);
    tables.set(table, rows);
  };

  const requireRows = <T extends TableName>(table: T, ids: readonly Id<T>[]) => {
    const wanted = new Set<string>(ids);
    const current = rowsOf(table);
    const found = new Set(current.filter((row) => wanted.has(row._id)).map((row) => row._id));
    const missing = ids.find((id) => !found.has(id));
    if (missing !== undefined) throw new Error(`no '${table}' row ${missing}`);
    return { current, wanted };
  };

  return {
    create: <T extends TableName>(table: T, fields: unknown): Id<T> => {
      const current = rowsOf(table);
      const id = mintId(table, new Set(current.map((row) => row._id)));
      const row = admittedRow(table, fields, id, now());
      commit(table, [...current, row]);
      return id;
    },

    createMany: <T extends TableName>(table: T, fields: readonly unknown[]): readonly Id<T>[] => {
      if (fields.length === 0) return [];
      const at = now();
      const current = rowsOf(table);
      const taken = new Set(current.map((row) => row._id));
      const ids = fields.map(() => {
        const id = mintId(table, taken);
        taken.add(id);
        return id;
      });
      // Admit every candidate before the one persistence boundary. A rejected
      // member therefore cannot leave a partial batch in memory or on disk.
      const created = fields.map((entry, index) => admittedRow(table, entry, ids[index], at));
      commit(table, [...current, ...created]);
      return ids;
    },

    removeRows: <T extends TableName>(table: T, ids: readonly Id<T>[]): void => {
      if (ids.length === 0) return;
      const { current, wanted } = requireRows(table, ids);
      commit(table, current.filter((row) => !wanted.has(row._id)));
    },

    removeFieldFromRows: <T extends TableName>(
      table: T,
      ids: readonly Id<T>[],
      field: string
    ): void => {
      if (ids.length === 0) return;
      if (field.length === 0 || field === "_id" || field === "_creationTime") {
        throw new Error("a removable row field is required");
      }
      const { current, wanted } = requireRows(table, ids);
      const rows = current.map((row) => {
        if (!wanted.has(row._id)) return row;
        const copy = { ...row } as Record<string, unknown>;
        delete copy[field];
        return copy as unknown as AnyRow;
      });
      commit(table, rows);
    },

    read: (path) => {
      const parsed = asPath(path);
      return readAt(rowsOf(parsed.table), parsed);
    },

    update: (path, value) => {
      const parsed = asPath(path);
      commit(parsed.table, writtenAt(rowsOf(parsed.table), parsed, asStorable(value)));
    },

    remove: (path) => {
      const parsed = asPath(path);
      commit(parsed.table, removedAt(rowsOf(parsed.table), parsed));
    }
  };
};
