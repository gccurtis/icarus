import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { asId } from "$representation/data/behavior/core/id";
import type { Id, Row } from "$representation/data/types/core/id";

export type Store<Table extends string, Fields> = {
  get(id: Id<Table>): (Row<Table> & Fields) | undefined;
  list(): (Row<Table> & Fields)[];
  insert(fields: Fields): Id<Table>;
  patch(id: Id<Table>, fields: Partial<Fields>): void;
  remove(id: Id<Table>): void;
  toJSON(): (Row<Table> & Fields)[];
};

export type StoreInput<Table extends string, Fields> = {
  readonly table: Table;
  /** This table's file. Absent keeps the store in memory. */
  readonly path?: string;
  /** Used only when the file does not exist yet. */
  readonly initial?: readonly (Row<Table> & Fields)[];
  readonly now?: () => number;
};

/**
 * Where the tables live, relative to the working directory — `app/data/` when
 * the server is run from `app/`, which is the only place it is run from.
 * Git-ignored.
 */
export const DATA_DIRECTORY = "data";

/** `<directory>/<table>.json`. One file per table, so a write touches one. */
export const pathFor = (directory: string, table: string): string =>
  join(directory, `${table}.json`);

/** Every row matching every field given. The scan a missing index becomes. */
export const where = <T extends object>(rows: readonly T[], match: Partial<T>): T[] =>
  rows.filter((row) =>
    Object.entries(match).every(([key, value]) => row[key as keyof T] === value)
  );

/** Highest sequence already used, so a reloaded store cannot mint an id it holds. */
const lastSequence = (table: string, ids: readonly string[]): number =>
  ids.reduce((highest, id) => {
    const parsed = Number(id.slice(`${table}:`.length));
    return id.startsWith(`${table}:`) && parsed > highest ? parsed : highest;
  }, 0);

/**
 * One table's rows, in memory and on disk.
 *
 * **Reads are in memory; every mutation writes the whole file.** A table is one
 * JSON array, so there is nothing to append to and nothing to keep in step — the
 * file after any call is exactly what the store holds. Synchronous, so a crash
 * cannot land between the change and the write.
 *
 * There are no indexes; `where` is the scan that replaces one. `patch` replaces
 * rather than mutates, so a row already read stays as it was.
 */
export const createStore = <Table extends string, Fields>({
  table,
  path,
  initial = [],
  now = Date.now
}: StoreInput<Table, Fields>): Store<Table, Fields> => {
  const loaded: readonly (Row<Table> & Fields)[] =
    path !== undefined && existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as (Row<Table> & Fields)[])
      : initial;

  const rows = new Map<string, Row<Table> & Fields>(loaded.map((row) => [row._id, row]));
  let sequence = lastSequence(table, [...rows.keys()]);

  const all = () => [...rows.values()];

  const save = () => {
    if (path === undefined) return;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(all(), null, 2)}\n`);
  };

  return {
    get: (id) => rows.get(id),

    list: all,

    insert: (fields) => {
      sequence += 1;
      const _id = asId<Table>(`${table}:${sequence}`);
      rows.set(_id, { ...fields, _id, _creationTime: now() });
      save();
      return _id;
    },

    patch: (id, fields) => {
      const existing = rows.get(id);
      if (existing === undefined) throw new Error(`no '${table}' row ${id}`);
      rows.set(id, { ...existing, ...fields, _id: existing._id });
      save();
    },

    remove: (id) => {
      rows.delete(id);
      save();
    },

    toJSON: all
  };
};
