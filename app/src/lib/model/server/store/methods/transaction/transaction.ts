import type { StoreState } from "$model/server/store/definition";
import { create } from "$model/server/store/methods/create";
import { createMany } from "$model/server/store/methods/create-many";
import { read } from "$model/server/store/methods/read";
import { remove } from "$model/server/store/methods/remove";
import { removeFieldFromRows } from "$model/server/store/methods/remove-field-from-rows";
import { removeRows } from "$model/server/store/methods/remove-rows";
import type { UnitOfWorkState } from "$model/server/store/methods/shared/state";
import { commit } from "$model/server/store/methods/transaction/commit.server";
import { update } from "$model/server/store/methods/update";
import type { StoreUnitOfWork } from "$model/server/store/types";

const unitOfWork = (state: UnitOfWorkState): StoreUnitOfWork => ({
  create: (table, fields) => create(state, table, fields),
  createMany: (table, fields) => createMany(state, table, fields),
  removeRows: (table, ids) => removeRows(state, table, ids),
  removeFieldFromRows: (table, ids, field) => removeFieldFromRows(state, table, ids, field),
  read: (path) => read(state, path),
  update: (path, value) => update(state, path, value),
  remove: (path) => remove(state, path)
});

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value !== null &&
  (typeof value === "object" || typeof value === "function") &&
  typeof (value as { then?: unknown }).then === "function";

/** Stages one synchronous intent, then crosses one durable commit boundary. */
export const transaction = <T>(
  store: StoreState,
  work: (unit: StoreUnitOfWork) => T
): T => {
  if (!store.available) {
    throw new Error("The Store was interrupted after commit and must be restarted");
  }
  if (store.transactionOpen) throw new Error("Store transactions cannot be nested");
  if (work.constructor.name === "AsyncFunction") {
    throw new Error("A Store transaction callback must be synchronous");
  }

  store.transactionOpen = true;
  const unit: UnitOfWorkState = {
    kind: "unit-of-work",
    now: store.now,
    tables: new Map(store.tables),
    isolated: new Set(),
    changed: new Set(),
    open: true
  };
  try {
    const result = work(unitOfWork(unit));
    if (isThenable(result)) throw new Error("A Store transaction callback must be synchronous");
    unit.open = false;
    commit(store, unit);
    return result;
  } finally {
    unit.open = false;
    store.transactionOpen = false;
  }
};
