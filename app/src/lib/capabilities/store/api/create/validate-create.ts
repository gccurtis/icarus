import type { CreateInput } from "$capabilities/store/types/create";
import type { TableName } from "$model/server/store/index.server";

export const validateCreate = (input: unknown): CreateInput => {
  if (input === null || typeof input !== "object") throw new Error("store/create: an input is an object");
  const { table, fields } = input as { table?: unknown; fields?: unknown };
  if (typeof table !== "string" || table.length === 0) {
    throw new Error("store/create: table is a non-empty string");
  }
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("store/create: fields is an object");
  }
  return { table: table as TableName, fields };
};
