/**
 * The structural types a variable may be declared as.
 *
 * Tables are the general data shape, and scalars, lists, and records are
 * explicit subtypes of it rather than things inferred from what arrived. That
 * matters because cardinality alone cannot preserve intent: a scalar and a
 * one-element list both have one field and one instance, so a catalog that
 * guessed would flatten the difference the author meant to state.
 *
 * | shape | fields | instances |
 * | --- | --- | --- |
 * | scalar | exactly one | exactly one |
 * | list | exactly one | zero or more |
 * | record | zero or more | exactly one |
 * | table | zero or more | zero or more |
 */
export type ScalarType =
  | { readonly kind: "number" }
  | { readonly kind: "text" }
  | { readonly kind: "logic" }
  | { readonly kind: "date" }
  | { readonly kind: "formula" }
  | { readonly kind: "function" }
  | { readonly kind: "reference" };

export interface Field {
  readonly name: string;
  readonly type: ValueType;
}

export interface ScalarTableType {
  readonly kind: "scalar";
  readonly field: Field;
}

export interface ListTableType {
  readonly kind: "list";
  readonly field: Field;
}

export interface RecordTableType {
  readonly kind: "record";
  readonly fields: readonly Field[];
}

export interface GeneralTableType {
  readonly kind: "table";
  readonly fields: readonly Field[];
}

export type TableType = ScalarTableType | ListTableType | RecordTableType | GeneralTableType;

/**
 * A field's type is either a scalar or a nested table, so declarations nest to
 * any depth. Admission carries the ancestor set down each branch to reject a
 * type that refers back to itself.
 */
export type ValueType = ScalarType | TableType;
