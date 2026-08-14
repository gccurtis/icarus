import type {
  GeneralTableType,
  ListTableType,
  RecordTableType,
  ScalarTableType,
  TableType
} from "#name-manager/types/schema.js";
import type {
  DataInputRecord,
  DataInputValue,
  DataRecord,
  DataValue
} from "#name-manager/types/values.js";

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
