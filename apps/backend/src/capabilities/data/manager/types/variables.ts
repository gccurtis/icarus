import type {
  GeneralTableType,
  ListTableType,
  RecordTableType,
  ScalarTableType,
  TableType
} from "#data-manager/types/schema.js";
import type {
  DataInputRecord,
  DataInputValue,
  DataRecord,
  DataValue
} from "#data-manager/types/values.js";

interface NamedVariableBase<TType extends TableType, TValue> {
  readonly name: string;
  readonly type: TType;
  readonly value: TValue;
}

export type NamedVariableInput =
  | NamedVariableBase<ScalarTableType, DataInputValue>
  | NamedVariableBase<ListTableType, readonly DataInputValue[]>
  | NamedVariableBase<RecordTableType, DataInputRecord>
  | NamedVariableBase<GeneralTableType, readonly DataInputRecord[]>;

export type NamedVariable =
  | NamedVariableBase<ScalarTableType, DataValue>
  | NamedVariableBase<ListTableType, readonly DataValue[]>
  | NamedVariableBase<RecordTableType, DataRecord>
  | NamedVariableBase<GeneralTableType, readonly DataRecord[]>;

/**
 * Declarations held by one runtime, keyed by the lower-cased lookup form of the
 * authored name. Iteration order is definition order.
 */
export type VariableCatalog = Map<string, NamedVariable>;

export type ReadonlyVariableCatalog = ReadonlyMap<string, NamedVariable>;
