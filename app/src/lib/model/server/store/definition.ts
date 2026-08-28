import { asPath, createdIn, readAt, removedAt, writtenAt, asStorable } from "$representation/store/path";
import type { AnyRow } from "$representation/store/path";
import type { Id } from "$representation/data/types/core/id";
import type { TableName } from "$representation/store/tables";

import { load } from "$model/server/store/methods/shared/load.server";
import { persist } from "$model/server/store/methods/shared/persist.server";
import type { StoreInput, StoreModel } from "$model/server/store/types";

export const defineStore = ({ directory, now = Date.now }: StoreInput): StoreModel => {
  const tables = load(directory);
  const rowsOf = (table: TableName): readonly AnyRow[] => tables.get(table) ?? [];

  const commit = (table: TableName, rows: readonly AnyRow[]) => {
    tables.set(table, rows);
    persist(directory, table, rows);
  };

  return {
    create: <T extends TableName>(table: T, fields: unknown): Id<T> => {
      const { rows, id } = createdIn(table, rowsOf(table), asStorable(fields), now());
      commit(table, rows);
      return id;
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
