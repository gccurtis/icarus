import type { TableFields, TableName } from "$representation/store/tables";

type KeysOfUnion<T> = T extends T ? keyof T : never;
type ValueAcrossUnion<T, K extends PropertyKey> = T extends T
  ? K extends keyof T
    ? T[K]
    : undefined
  : never;

/** Every represented field declares whether absence is part of its current meaning. */
export type FieldPolicy<T extends TableName> = {
  [K in KeysOfUnion<TableFields[T]>]-?: undefined extends ValueAcrossUnion<TableFields[T], K>
    ? "optional"
    : "required";
};

/** The complete, compile-time checked field policy for every represented table. */
export type CurrentRowPolicies = {
  [T in TableName]: FieldPolicy<T>;
};
