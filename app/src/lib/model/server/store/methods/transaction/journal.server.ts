import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { asTable } from "$representation/store/admission";
import { admitAnyRows } from "$representation/store/current-row";
import type { AnyRow } from "$representation/store/path";
import type { TableName } from "$representation/store/tables";

import {
  removeDurableFile,
  writeDurableFile
} from "$model/server/store/methods/shared/durable-file.server";

const NAME = ".store-transaction.json";
const exact = (value: Record<string, unknown>, fields: readonly string[]): boolean =>
  Object.keys(value).every((field) => fields.includes(field));

export type JournalChange = {
  readonly table: TableName;
  readonly rows: readonly AnyRow[];
};

export type StoreJournal = {
  readonly version: 1;
  readonly transactionId: string;
  readonly state: "committed";
  readonly changes: readonly JournalChange[];
};

export const journalPath = (directory: string): string => join(directory, NAME);

const asRows = (value: unknown, table: TableName): readonly AnyRow[] => {
  try {
    return admitAnyRows(table, value);
  } catch (error) {
    throw new Error(`Store journal '${table}' contains a non-current row`, { cause: error });
  }
};

const admitJournal = (value: unknown): StoreJournal => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Store journal is not an object");
  }
  const record = value as Record<string, unknown>;
  if (!exact(record, ["version", "transactionId", "state", "changes"])) {
    throw new Error("Store journal has unknown fields");
  }
  if (record.version !== 1 || record.state !== "committed") {
    throw new Error("Store journal has an unsupported schema");
  }
  if (typeof record.transactionId !== "string" || record.transactionId.length === 0) {
    throw new Error("Store journal has no transaction id");
  }
  if (!Array.isArray(record.changes) || record.changes.length === 0) {
    throw new Error("Store journal has no table changes");
  }
  const seen = new Set<TableName>();
  const changes = record.changes.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Store journal contains an invalid table change");
    }
    const change = entry as Record<string, unknown>;
    if (!exact(change, ["table", "rows"])) {
      throw new Error("Store journal contains a table change with unknown fields");
    }
    const table = asTable(change.table);
    if (seen.has(table)) throw new Error(`Store journal repeats '${table}'`);
    seen.add(table);
    return { table, rows: asRows(change.rows, table) };
  });
  return {
    version: 1,
    transactionId: record.transactionId,
    state: "committed",
    changes
  };
};

export const writeJournal = (directory: string, journal: StoreJournal): void => {
  writeDurableFile(journalPath(directory), `${JSON.stringify(journal, null, 2)}\n`);
};

export const readJournal = (directory: string): StoreJournal | undefined => {
  const path = journalPath(directory);
  if (!existsSync(path)) return undefined;
  return admitJournal(JSON.parse(readFileSync(path, "utf8")));
};

export const removeJournal = (directory: string): void => {
  removeDurableFile(journalPath(directory));
};

/** An unrenamed next-file contains no durable commit decision. */
export const discardUndecidedJournal = (directory: string): void => {
  rmSync(`${journalPath(directory)}.next`, { force: true });
};
