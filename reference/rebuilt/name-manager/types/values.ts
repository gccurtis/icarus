import type { DateInput, DateValue } from "$name-manager/types/dates";

/**
 * The data a variable holds, in the two forms it takes.
 *
 * The input and value families differ only where dates do — see
 * [`dates.ts`](dates.ts). Everything else is the same shape on both sides, and
 * they are still written twice rather than parameterized, because a single
 * generic family would let an un-admitted `DateInput` reach a position that
 * promises a `DateValue`.
 */
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
