import type {
  DateInput,
  DateValue
} from "#data-manager/types/dates.js";

export interface DataInputRecord {
  readonly [fieldName: string]: DataInputValue;
}

export type DataInputValue =
  | number
  | string
  | boolean
  | DateInput
  | DataInputRecord
  | readonly DataInputValue[];

export interface DataRecord {
  readonly [fieldName: string]: DataValue;
}

export type DataValue =
  | number
  | string
  | boolean
  | DateValue
  | DataRecord
  | readonly DataValue[];
