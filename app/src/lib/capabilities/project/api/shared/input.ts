import {
  hasExactFields,
  isStoredJson,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableName } from "$model/server/store/index.server";

export const projectInput = (
  value: unknown,
  fields: readonly string[],
  message: string
): Record<string, unknown> => {
  const input = storedFields(value);
  if (input === undefined || !isStoredJson(value) || !hasExactFields(input, fields)) {
    throw new Error(message);
  }
  return input;
};

export const projectRowId = <T extends TableName>(
  value: unknown,
  table: T,
  message: string
): string => {
  if (!isStoredRowId(value, table)) throw new Error(message);
  return value;
};

const RESOURCE_TABLES = [
  "documents",
  "presentations",
  "spreadsheets",
  "researchThreads",
  "findings"
] as const satisfies readonly TableName[];

export const projectResourceId = (value: unknown, message: string): string => {
  if (!RESOURCE_TABLES.some((table) => isStoredRowId(value, table))) throw new Error(message);
  return value as string;
};
