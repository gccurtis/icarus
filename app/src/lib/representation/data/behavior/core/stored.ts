import type { Actor } from "$representation/data/types/core/actor";
import type { TableName } from "$representation/store/tables";

export type StoredFields = Record<string, unknown>;

export const storedFields = (value: unknown): StoredFields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as StoredFields
    : undefined;

export const hasExactFields = (
  value: StoredFields,
  required: readonly string[],
  optional: readonly string[] = []
): boolean => {
  const fields = Object.keys(value);
  return required.every((field) => fields.includes(field)) &&
    fields.every((field) => required.includes(field) || optional.includes(field));
};

export const isStoredText = (value: unknown, maximum = 100_000): value is string =>
  typeof value === "string" && value.length <= maximum;

export const isStoredIdentifier = (value: unknown, maximum = 500): value is string =>
  isStoredText(value, maximum) &&
  value.length > 0 &&
  value === value.trim() &&
  !/[.\s]/.test(value);

/** One nominal current Store id, including the represented table namespace. */
export const isStoredRowId = (value: unknown, table: TableName | "_storage"): value is string =>
  (table === "projects" && value === "default") ||
  (table === "users" && value === "default-user") ||
  (
    isStoredIdentifier(value) &&
    value.startsWith(`${table}:`) &&
    value.length > table.length + 1 &&
    !value.slice(table.length + 1).includes(":")
  );

export const isStoredTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export const isStoredFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isStoredNatural = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export const isStoredChoice = <T extends string>(
  value: unknown,
  choices: readonly T[]
): value is T => typeof value === "string" && choices.includes(value as T);

const exactJsonProperties = (
  value: object,
  keys: readonly string[],
  nonEnumerable: readonly string[] = []
): boolean => {
  const own = Reflect.ownKeys(value);
  const strings = own.filter((key): key is string => typeof key === "string");
  if (strings.length !== own.length || strings.length !== keys.length) return false;
  return strings.every((key) => keys.includes(key)) && keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor &&
      descriptor.enumerable === !nonEnumerable.includes(key);
  });
};

/** Exact, byte-round-trip-stable JSON admission for intentionally open values. */
export const isStoredJson = (value: unknown): boolean => {
  const ancestors = new WeakSet<object>();
  const visit = (held: unknown, depth: number): boolean => {
    if (depth > 32 || held === undefined) return false;
    if (held === null || typeof held === "string" || typeof held === "boolean") return true;
    if (typeof held === "number") return Number.isFinite(held) && !Object.is(held, -0);
    if (typeof held !== "object" || ancestors.has(held)) return false;
    ancestors.add(held);
    let admitted: boolean;
    if (Array.isArray(held)) {
      const keys = Object.keys(held);
      admitted = Object.getPrototypeOf(held) === Array.prototype &&
        exactJsonProperties(held, [...keys, "length"], ["length"]) &&
        keys.length === held.length &&
        keys.every((key, index) => key === String(index)) &&
        held.every((entry) => visit(entry, depth + 1));
    } else {
      const prototype = Object.getPrototypeOf(held);
      const keys = Object.keys(held);
      admitted = (prototype === Object.prototype || prototype === null) &&
        exactJsonProperties(held, keys) &&
        keys.every((key) => visit((held as StoredFields)[key], depth + 1));
    }
    ancestors.delete(held);
    return admitted;
  };
  return visit(value, 0);
};

export const isStoredActor = (value: unknown): value is Actor => {
  const actor = storedFields(value);
  if (actor === undefined) return false;
  if (actor.kind === "system") return hasExactFields(actor, ["kind"]);
  if (actor.kind === "user") {
    return hasExactFields(actor, ["kind", "userId"]) && isStoredRowId(actor.userId, "users");
  }
  if (actor.kind === "agent") {
    return hasExactFields(actor, ["kind", "taskId"]) && isStoredRowId(actor.taskId, "agentTasks");
  }
  return actor.kind === "connector" &&
    hasExactFields(actor, ["kind", "connectorId"]) &&
    isStoredRowId(actor.connectorId, "connectors");
};
