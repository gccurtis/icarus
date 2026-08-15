import type {
  GeneralTableType,
  ListTableType,
  RecordTableType,
  ScalarTableType,
  TableType
} from "$name-manager/types/schema";
import type {
  DataInputRecord,
  DataInputValue,
  DataRecord,
  DataValue
} from "$name-manager/types/values";

/**
 * A declaration: a name, the shape it was declared as, and what it holds.
 *
 * **No project, and no user.** Both come from the scope the procedure was called
 * with, which is why neither has a field here to be spoofed. See
 * [`requests.ts`](requests.ts) for the browser-facing shapes, which differ by
 * exactly one field.
 */
interface NamedVariableBase<TType extends TableType, TValue> {
  readonly name: string;
  readonly type: TType;
  readonly value: TValue;
}

/**
 * The union pairs each table shape with the value shape it admits, so the
 * compiler refuses a record value under a list declaration before admission ever
 * runs. A single `type: TableType; value: DataValue` pair would accept every
 * mismatch and leave the whole check to runtime.
 */
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
