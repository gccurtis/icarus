import type { Id } from "$representation/data/types/core/id";
import type { AnyRow, Found } from "$representation/store/path";
import type { TableName } from "$representation/store/tables";

import { create } from "$model/server/store/methods/create";
import { createMany } from "$model/server/store/methods/create-many";
import { read } from "$model/server/store/methods/read";
import { remove } from "$model/server/store/methods/remove";
import { removeFieldFromRows } from "$model/server/store/methods/remove-field-from-rows";
import { removeRows } from "$model/server/store/methods/remove-rows";
import { transaction } from "$model/server/store/methods/transaction/transaction";
import { update } from "$model/server/store/methods/update";
import type {
  StoreFailpoint,
  StoreModel,
  StoreUnitOfWork
} from "$model/server/store/types";

export type StoreState = {
  readonly kind: "store";
  readonly directory?: string;
  readonly now: () => number;
  readonly tables: Map<TableName, readonly AnyRow[]>;
  readonly failpoint?: (point: StoreFailpoint) => void;
  transactionOpen: boolean;
  available: boolean;
};

/** One process-owned table set. Public behavior delegates into methods/. */
export class JsonStore implements StoreModel {
  readonly #state: StoreState;

  constructor(state: StoreState) {
    this.#state = state;
  }

  create<T extends TableName>(table: T, fields: unknown): Id<T> {
    return create(this.#state, table, fields);
  }

  createMany<T extends TableName>(table: T, fields: readonly unknown[]): readonly Id<T>[] {
    return createMany(this.#state, table, fields);
  }

  removeRows<T extends TableName>(table: T, ids: readonly Id<T>[]): void {
    return removeRows(this.#state, table, ids);
  }

  removeFieldFromRows<T extends TableName>(
    table: T,
    ids: readonly Id<T>[],
    field: string
  ): void {
    return removeFieldFromRows(this.#state, table, ids, field);
  }

  read(path: string): Found | undefined {
    return read(this.#state, path);
  }

  update(path: string, value: unknown): void {
    return update(this.#state, path, value);
  }

  remove(path: string): void {
    return remove(this.#state, path);
  }

  transaction<T>(work: (unit: StoreUnitOfWork) => T): T {
    return transaction(this.#state, work);
  }
}
