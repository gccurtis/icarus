import type { RemoteQuery, RemoteQueryUpdate } from "@sveltejs/kit";
import * as remote from "$json-store/store.remote";
import type { TableFields, TableName, TableRow } from "$json-store/tables";
import type { Id } from "$json-store/types/core/id";

/**
 * The typed door a view calls.
 *
 * A remote function cannot be generic — kit wraps it, so the five in
 * [`store.remote.ts`](store.remote.ts) speak in the union of every table's rows.
 * These narrow that union to the one table named, so a call site gets
 * `Document[]` rather than something to hand-check.
 *
 * **Each cast is safe because the server dispatches on the same `table` value it
 * was handed**, so the row type and the name cannot disagree. That is a fact the
 * type system has no way to carry across the wire, which is why it is asserted
 * here — once, in one place — rather than at every call site.
 */

/** What a command returns: the result, plus the queries it should refresh. */
type Command<Output> = Promise<Output> & {
  updates(...updates: RemoteQueryUpdate[]): Promise<Output>;
};

export const list = <T extends TableName>(table: T): RemoteQuery<TableRow<T>[]> =>
  remote.list(table) as unknown as RemoteQuery<TableRow<T>[]>;

export const get = <T extends TableName>(
  table: T,
  id: Id<T>
): RemoteQuery<TableRow<T> | undefined> =>
  remote.get({ table, id }) as unknown as RemoteQuery<TableRow<T> | undefined>;

export const insert = <T extends TableName>(table: T, fields: TableFields[T]): Command<Id<T>> =>
  remote.insert({ table, fields }) as unknown as Command<Id<T>>;

export const patch = <T extends TableName>(
  table: T,
  id: Id<T>,
  fields: Partial<TableFields[T]>
): Command<void> => remote.patch({ table, id, fields });

export const remove = <T extends TableName>(table: T, id: Id<T>): Command<void> =>
  remote.remove({ table, id });
