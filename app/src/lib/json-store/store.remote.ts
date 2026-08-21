import { command, query } from "$app/server";
import { asRowId, asTable } from "$json-store/admission";
import { createStore, DATA_DIRECTORY, pathFor } from "$json-store/store.server";
import type { TableFields, TableName, TableRow } from "$json-store/tables";

/**
 * The whole store's public surface: five functions over any table, rather than
 * five per table.
 *
 * **Reads are `query` and writes are `command`**, which is the one split worth
 * having at the door — a caller cannot reach a write by asking for a read.
 *
 * **Nothing here is gated.** A remote function is reachable by anything that can
 * hit the origin, and `insert` covers `memberships`, which is the table that
 * decides who may reach a project. Whatever authorization arrives goes in front
 * of these five and nowhere else.
 */

/**
 * A table is opened per call and used in one synchronous stretch.
 *
 * The file is read on open and written on every mutation, so a store built here
 * always matches disk — there is nothing long-lived to go stale. Node is single
 * threaded and none of this awaits, so two calls cannot interleave.
 */
const open = <T extends TableName>(table: T) =>
  createStore<T, TableFields[T]>({ table, path: pathFor(DATA_DIRECTORY, table) });

type Named = { table: unknown };
type Identified = Named & { id: unknown };
type Written = Named & { fields: unknown };

export const list = query("unchecked", (table: unknown): TableRow<TableName>[] =>
  open(asTable(table)).list()
);

export const get = query(
  "unchecked",
  ({ table, id }: Identified): TableRow<TableName> | undefined =>
    open(asTable(table)).get(asRowId(id))
);

/**
 * `fields` is whatever arrived. Nothing validates it against the table's shape —
 * the row types say what a caller *should* send, and the store writes what it is
 * given.
 */
export const insert = command("unchecked", ({ table, fields }: Written): string =>
  open(asTable(table)).insert(fields as TableFields[TableName])
);

export const patch = command("unchecked", ({ table, id, fields }: Identified & Written): void => {
  open(asTable(table)).patch(asRowId(id), fields as Partial<TableFields[TableName]>);
});

export const remove = command("unchecked", ({ table, id }: Identified): void => {
  open(asTable(table)).remove(asRowId(id));
});
