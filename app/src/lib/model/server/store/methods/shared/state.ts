import type { AnyRow } from "$representation/store/path";
import { admitAnyRows } from "$representation/store/current-row";
import type { TableName } from "$representation/store/tables";

import type { StoreState } from "$model/server/store/definition";
import { persist } from "$model/server/store/methods/shared/persist.server";

export type UnitOfWorkState = {
  readonly kind: "unit-of-work";
  readonly now: () => number;
  readonly tables: Map<TableName, readonly AnyRow[]>;
  readonly isolated: Set<TableName>;
  readonly changed: Set<TableName>;
  open: boolean;
};

export type MutationState = StoreState | UnitOfWorkState;

export const requireAvailable = (state: MutationState): void => {
  if (state.kind === "store" && !state.available) {
    throw new Error("The Store was interrupted after commit and must be restarted");
  }
  if (state.kind === "unit-of-work" && !state.open) {
    throw new Error("This Store unit of work is closed");
  }
  if (state.kind === "store" && state.transactionOpen) {
    throw new Error("Use the supplied Store unit of work inside a transaction");
  }
};

export const rowsOf = (
  state: MutationState,
  table: TableName
): readonly AnyRow[] => {
  requireAvailable(state);
  if (state.kind === "unit-of-work" && !state.isolated.has(table)) {
    state.tables.set(table, structuredClone(state.tables.get(table) ?? []));
    state.isolated.add(table);
  }
  return state.tables.get(table) ?? [];
};

export const replaceRows = (
  state: MutationState,
  table: TableName,
  rows: readonly AnyRow[]
): void => {
  requireAvailable(state);
  const current = admitAnyRows(table, rows);
  if (state.kind === "unit-of-work") {
    state.tables.set(table, current);
    state.changed.add(table);
    return;
  }
  persist(state.directory, table, current);
  state.tables.set(table, current);
};
