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

export type TableType =
  | ScalarTableType
  | ListTableType
  | RecordTableType
  | GeneralTableType;

export type ValueType = ScalarType | TableType;
